package local.habittracker.app.sound;

import android.content.Context;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Loads a Fokus-Klang once into the app cache, with the WebView's session
 * cookie, and keeps only the current version of each sound. Blocking: call
 * it off the main thread.
 */
final class FocusSoundDownloader {
    private static final int CONNECT_TIMEOUT_MS = 15_000;
    private static final int READ_TIMEOUT_MS = 30_000;

    private FocusSoundDownloader() {}

    static File ensure(Context context, String id, String url, String cookie) throws IOException {
        URL address = new URL(url);
        String scheme = address.getProtocol();
        if (!"https".equals(scheme) && !"http".equals(scheme)) {
            throw new IOException("Adresse ohne http(s): " + scheme);
        }
        File dir = new File(context.getCacheDir(), FocusSoundCache.DIRECTORY);
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("Cache-Ordner fehlt");

        String name = FocusSoundCache.fileName(id, url);
        File file = new File(dir, name);
        if (!file.isFile() || file.length() == 0) download(address, cookie, dir, name, file);
        for (String stale : FocusSoundCache.staleNames(dir.list(), id, name)) {
            // Best effort: a file left behind only costs space until the next play.
            new File(dir, stale).delete();
        }
        return file;
    }

    private static void download(URL address, String cookie, File dir, String name, File file) throws IOException {
        File partial = new File(dir, FocusSoundCache.partialName(name));
        HttpURLConnection connection = (HttpURLConnection) address.openConnection();
        try {
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            if (cookie != null && !cookie.isEmpty()) connection.setRequestProperty("Cookie", cookie);
            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) throw new IOException("HTTP " + status);
            try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(partial)) {
                byte[] buffer = new byte[16 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            }
            if (partial.length() == 0) throw new IOException("Leere Datei");
            if (!partial.renameTo(file)) throw new IOException("Datei nicht gespeichert");
        } catch (IOException e) {
            partial.delete();
            throw e;
        } finally {
            connection.disconnect();
        }
    }
}
