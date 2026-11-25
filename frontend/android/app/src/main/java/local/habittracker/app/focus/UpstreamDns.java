package local.habittracker.app.focus;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Picks the DNS servers the website filter forwards to, from plain data so
 * it runs without Android: the servers of every network that reaches the
 * internet and is not a VPN (this filter is one), IPv4 first, each once.
 * FocusVpnService turns Android's network objects into {@link Network}.
 */
final class UpstreamDns {
    /**
     * Only if no network names a DNS server: Quad9, run by a non-profit
     * that by its policy keeps no IP addresses. It sees names, never content.
     */
    static final InetAddress FALLBACK = literal(9, 9, 9, 9);

    private UpstreamDns() {}

    /** What the filter needs to know about one network. */
    static final class Network {
        final boolean vpn;
        final boolean internet;
        final List<InetAddress> dnsServers;

        Network(boolean vpn, boolean internet, List<InetAddress> dnsServers) {
            this.vpn = vpn;
            this.internet = internet;
            this.dnsServers = dnsServers == null ? Collections.<InetAddress>emptyList() : dnsServers;
        }
    }

    /** The servers to ask, in order; never empty. */
    static List<InetAddress> select(List<Network> networks) {
        Set<InetAddress> ipv4 = new LinkedHashSet<InetAddress>();
        Set<InetAddress> other = new LinkedHashSet<InetAddress>();
        for (Network network : networks) {
            if (network == null || network.vpn || !network.internet) continue;
            for (InetAddress address : network.dnsServers) {
                if (address == null) continue;
                if (address instanceof Inet4Address) ipv4.add(address);
                else other.add(address);
            }
        }
        List<InetAddress> result = new ArrayList<InetAddress>(ipv4);
        result.addAll(other);
        if (result.isEmpty()) result.add(FALLBACK);
        return Collections.unmodifiableList(result);
    }

    private static InetAddress literal(int a, int b, int c, int d) {
        try {
            return InetAddress.getByAddress(new byte[] {(byte) a, (byte) b, (byte) c, (byte) d});
        } catch (UnknownHostException error) {
            // Only thrown for a wrong length.
            throw new IllegalStateException(error);
        }
    }
}
