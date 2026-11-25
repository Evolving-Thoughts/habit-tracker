package local.habittracker.app.focus;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.net.ConnectivityManager;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.VpnService;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import local.habittracker.app.MainActivity;
import local.habittracker.app.R;

/**
 * The website filter: a local VPN that carries nothing but DNS. It routes
 * only a made-up DNS server address (10.111.222.2) into the app and names
 * it as the DNS server of the browsers on the phone; every other packet
 * goes its normal way. A lookup of a blocked host gets NXDOMAIN; any other
 * lookup goes to the DNS server of the current network, as before. Nothing
 * is logged or kept. It runs only while a block covers websites.
 */
public class FocusVpnService extends VpnService {
    public static final String ACTION_STOP = "local.habittracker.app.focus.STOP";
    private static final String TAG = "FocusVpnService";
    private static final String CHANNEL = "focus_block";
    private static final int NOTIFICATION = 4711;
    private static final String TUN_ADDRESS = "10.111.222.1";
    private static final String DNS_ADDRESS = "10.111.222.2";
    private static final int DNS_TIMEOUT_MS = 5_000;
    private static final long CHECK_MS = 30_000;

    private static volatile boolean running;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable check = new Runnable() {
        @Override
        public void run() {
            if (!wanted()) {
                shutDown();
                return;
            }
            handler.postDelayed(this, CHECK_MS);
        }
    };
    private final Runnable onChange = () -> {
        if (!wanted()) shutDown();
    };
    private ParcelFileDescriptor tun;
    private Thread reader;
    private ExecutorService lookups;
    private final Object upstreamLock = new Object();
    /** Replaced as a whole on network changes; read without a lock. */
    private volatile List<InetAddress> upstream = Collections.singletonList(UpstreamDns.FALLBACK);
    private volatile ConnectivityManager.NetworkCallback networkCallback;

    public static boolean isRunning() {
        return running;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            shutDown();
            return START_NOT_STICKY;
        }
        startInForeground();
        if (!wanted() || !establish()) {
            shutDown();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    private boolean wanted() {
        FocusBlockState state = FocusBlockStore.load(this);
        return state.isActive(System.currentTimeMillis()) && state.filtersDomains();
    }

    private void startInForeground() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, getString(R.string.focus_vpn_channel), NotificationManager.IMPORTANCE_LOW);
            manager.createNotificationChannel(channel);
        }
        PendingIntent open = PendingIntent.getActivity(
            this,
            0,
            new Intent(this, MainActivity.class).putExtra(BlockActivity.EXTRA_OPEN_FOCUS, true),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentTitle(getString(R.string.focus_vpn_title))
            .setContentText(getString(R.string.focus_vpn_text))
            .setContentIntent(open)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(NOTIFICATION, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(NOTIFICATION, notification);
            }
        } catch (RuntimeException error) {
            // The VPN keeps running without; Android shows its key symbol anyway.
            Log.w(TAG, "No foreground notification", error);
        }
    }

    private boolean establish() {
        if (tun != null) return true;
        refreshUpstream();
        Builder builder = new Builder()
            .setSession(getString(R.string.focus_vpn_session))
            .addAddress(TUN_ADDRESS, 32)
            .addDnsServer(DNS_ADDRESS)
            .addRoute(DNS_ADDRESS, 32)
            .setBlocking(true);
        int browsers = 0;
        for (String name : FocusBlockController.browsers(this)) {
            try {
                builder.addAllowedApplication(name);
                browsers++;
            } catch (PackageManager.NameNotFoundException ignored) {
                // Uninstalled meanwhile.
            }
        }
        // Without a browser there is nothing to filter; never cover every app.
        if (browsers == 0) return false;
        Intent configure = new Intent(this, MainActivity.class).putExtra(BlockActivity.EXTRA_OPEN_FOCUS, true);
        builder.setConfigureIntent(PendingIntent.getActivity(this, 1, configure, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        try {
            tun = builder.establish();
        } catch (RuntimeException error) {
            Log.w(TAG, "Could not set up the website filter", error);
            return false;
        }
        if (tun == null) return false;
        running = true;
        lookups = Executors.newFixedThreadPool(4);
        reader = new Thread(this::readLoop, "focus-dns");
        reader.start();
        watchNetworks();
        FocusBlockStore.addListener(onChange);
        FocusBlockSync.start(this);
        handler.postDelayed(check, CHECK_MS);
        return true;
    }

    private void readLoop() {
        ParcelFileDescriptor descriptor = tun;
        if (descriptor == null) return;
        FileInputStream in = new FileInputStream(descriptor.getFileDescriptor());
        final FileOutputStream out = new FileOutputStream(descriptor.getFileDescriptor());
        byte[] buffer = new byte[32767];
        while (running && !Thread.currentThread().isInterrupted()) {
            int length;
            try {
                length = in.read(buffer);
            } catch (IOException error) {
                break;
            }
            if (length <= 0) continue;
            final DnsPacket.Query query = DnsPacket.parse(buffer, length);
            if (query == null) continue;
            FocusBlockState state = FocusBlockStore.load(this);
            if (state.isActive(System.currentTimeMillis()) && FocusBlockPolicy.isHostBlocked(query.name, state)) {
                write(out, DnsPacket.reply(query, DnsPacket.nxdomain(query.dns)));
                continue;
            }
            ExecutorService pool = lookups;
            if (pool == null) break;
            try {
                pool.execute(() -> forward(out, query));
            } catch (RuntimeException error) {
                break;
            }
        }
    }

    /** Asks the network's own DNS server and hands its answer back unchanged. */
    private void forward(FileOutputStream out, DnsPacket.Query query) {
        // One snapshot: a network change swaps the whole list, never edits it.
        List<InetAddress> servers = upstream;
        for (InetAddress server : servers) {
            try (DatagramSocket socket = new DatagramSocket()) {
                // Outside the VPN, so the question does not come back here.
                protect(socket);
                socket.setSoTimeout(DNS_TIMEOUT_MS);
                socket.send(new DatagramPacket(query.dns, query.dns.length, new InetSocketAddress(server, 53)));
                byte[] answer = new byte[4096];
                DatagramPacket packet = new DatagramPacket(answer, answer.length);
                socket.receive(packet);
                byte[] dns = new byte[packet.getLength()];
                System.arraycopy(answer, 0, dns, 0, dns.length);
                write(out, DnsPacket.reply(query, dns));
                return;
            } catch (IOException error) {
                // Try the next server; without an answer the browser retries.
            }
        }
    }

    private void write(FileOutputStream out, byte[] packet) {
        synchronized (this) {
            try {
                out.write(packet);
            } catch (IOException ignored) {
                // The interface is closing.
            }
        }
    }

    /**
     * Reads the DNS servers of the networks in use (not this VPN) again,
     * see UpstreamDns. Called at the start and on every network change, so
     * moving from Wi-Fi to mobile data never leaves lookups at a dead server.
     */
    private void refreshUpstream() {
        synchronized (upstreamLock) {
            upstream = UpstreamDns.select(currentNetworks());
        }
    }

    private List<UpstreamDns.Network> currentNetworks() {
        List<UpstreamDns.Network> result = new ArrayList<UpstreamDns.Network>();
        ConnectivityManager connectivity = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivity == null) return result;
        try {
            for (Network network : connectivity.getAllNetworks()) {
                NetworkCapabilities capabilities = connectivity.getNetworkCapabilities(network);
                LinkProperties link = connectivity.getLinkProperties(network);
                if (capabilities == null || link == null) continue;
                result.add(new UpstreamDns.Network(
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN),
                    capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET),
                    link.getDnsServers()
                ));
            }
        } catch (RuntimeException error) {
            // A network vanished while being read; the next change reads again.
            Log.w(TAG, "Could not read the networks", error);
        }
        return result;
    }

    /** Re-reads the DNS servers whenever the network changes. */
    private void watchNetworks() {
        if (networkCallback != null) return;
        ConnectivityManager connectivity = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivity == null) return;
        ConnectivityManager.NetworkCallback callback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(Network network) {
                refreshUpstream();
            }

            @Override
            public void onLost(Network network) {
                refreshUpstream();
            }

            @Override
            public void onLinkPropertiesChanged(Network network, LinkProperties link) {
                refreshUpstream();
            }

            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                refreshUpstream();
            }
        };
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                // The app itself is not inside its VPN, so this is the real network.
                connectivity.registerDefaultNetworkCallback(callback);
            } else {
                NetworkRequest request = new NetworkRequest.Builder()
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                    .addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
                    .build();
                connectivity.registerNetworkCallback(request, callback);
            }
            networkCallback = callback;
        } catch (RuntimeException error) {
            // Without it the servers read at the start stay in use.
            Log.w(TAG, "Could not watch network changes", error);
        }
    }

    private void unwatchNetworks() {
        ConnectivityManager.NetworkCallback callback = networkCallback;
        networkCallback = null;
        if (callback == null) return;
        ConnectivityManager connectivity = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivity == null) return;
        try {
            connectivity.unregisterNetworkCallback(callback);
        } catch (RuntimeException ignored) {
            // Not registered (any more).
        }
    }

    private void shutDown() {
        running = false;
        handler.removeCallbacks(check);
        FocusBlockStore.removeListener(onChange);
        unwatchNetworks();
        if (tun != null) {
            FocusBlockSync.stop();
            try {
                tun.close();
            } catch (IOException ignored) {
                // Closed already.
            }
            tun = null;
        }
        if (reader != null) reader.interrupt();
        reader = null;
        if (lookups != null) lookups.shutdownNow();
        lookups = null;
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onRevoke() {
        // Disconnected in Android's VPN settings: the block holds for apps only.
        shutDown();
        super.onRevoke();
    }

    @Override
    public void onDestroy() {
        if (running) shutDown();
        super.onDestroy();
    }
}
