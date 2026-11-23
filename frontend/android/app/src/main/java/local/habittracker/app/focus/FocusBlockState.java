package local.habittracker.app.focus;

import java.util.Collections;
import java.util.List;

/**
 * The block as the server last described it (GET /api/focus-block), plus
 * what this phone added: the clock difference to the server and a Soft
 * block lifted here. Plain data without Android types, so the rules can be
 * tested on the JVM (see FocusBlockPolicy).
 */
public final class FocusBlockState {
    /** A Soft block whose stopwatch nobody ends lifts itself after this long. */
    public static final long SOFT_BLOCK_MAX_MS = 12L * 60 * 60 * 1000;

    public final String version;
    /** Null while no block is open. */
    public final String blockId;
    public final String title;
    /** "soft" or "hardcore". */
    public final String mode;
    /** "blocklist" or "allowlist". */
    public final String listMode;
    public final long startedAtMs;
    /** Hardcore: when the Soll is reached. Null for Soft. */
    public final Long endsAtMs;
    public final List<String> blockApps;
    public final List<String> allowApps;
    public final List<String> blockDomains;
    public final List<String> allowDomains;
    /** Hosts the app itself needs; never blocked. */
    public final List<String> fixedDomains;
    /** Device clock minus server clock when the state arrived. */
    public final long skewMs;
    /** A Soft block lifted on this phone; it stays lifted here. */
    public final String liftedBlockId;

    public FocusBlockState(
        String version,
        String blockId,
        String title,
        String mode,
        String listMode,
        long startedAtMs,
        Long endsAtMs,
        List<String> blockApps,
        List<String> allowApps,
        List<String> blockDomains,
        List<String> allowDomains,
        List<String> fixedDomains,
        long skewMs,
        String liftedBlockId
    ) {
        this.version = version;
        this.blockId = blockId;
        this.title = title;
        this.mode = mode;
        this.listMode = listMode;
        this.startedAtMs = startedAtMs;
        this.endsAtMs = endsAtMs;
        this.blockApps = unmodifiable(blockApps);
        this.allowApps = unmodifiable(allowApps);
        this.blockDomains = unmodifiable(blockDomains);
        this.allowDomains = unmodifiable(allowDomains);
        this.fixedDomains = unmodifiable(fixedDomains);
        this.skewMs = skewMs;
        this.liftedBlockId = liftedBlockId;
    }

    /** No block, no lists: what a phone holds before the first answer. */
    public static FocusBlockState empty() {
        return new FocusBlockState(
            "",
            null,
            "",
            "soft",
            "blocklist",
            0,
            null,
            null,
            null,
            null,
            null,
            null,
            0,
            null
        );
    }

    private static List<String> unmodifiable(List<String> values) {
        return values == null ? Collections.<String>emptyList() : Collections.unmodifiableList(values);
    }

    public boolean isHardcore() {
        return "hardcore".equals(mode) && endsAtMs != null;
    }

    public boolean isStrict() {
        return "allowlist".equals(listMode);
    }

    /** The server's clock as this phone reads it. */
    public long serverNow(long deviceNowMs) {
        return deviceNowMs - skewMs;
    }

    /**
     * Whether the block holds at this moment of the device clock: open on
     * the server, not lifted here, and before its end (Hardcore at the
     * Soll, Soft after twelve hours, as on the server).
     */
    public boolean isActive(long deviceNowMs) {
        if (blockId == null) return false;
        if (!isHardcore() && blockId.equals(liftedBlockId)) return false;
        long now = serverNow(deviceNowMs);
        if (isHardcore()) return now < endsAtMs;
        return now < startedAtMs + SOFT_BLOCK_MAX_MS;
    }

    /** Whole minutes left of a Hardcore block, rounded up; -1 for Soft. */
    public long minutesLeft(long deviceNowMs) {
        if (!isHardcore()) return -1;
        long left = endsAtMs - serverNow(deviceNowMs);
        if (left <= 0) return 0;
        return (left + 59_999) / 60_000;
    }

    /** The same state with this block lifted on the phone. */
    public FocusBlockState lifted() {
        return new FocusBlockState(
            version,
            blockId,
            title,
            mode,
            listMode,
            startedAtMs,
            endsAtMs,
            blockApps,
            allowApps,
            blockDomains,
            allowDomains,
            fixedDomains,
            skewMs,
            blockId
        );
    }

    /** Whether websites need the DNS filter during this block. */
    public boolean filtersDomains() {
        return isStrict() || !blockDomains.isEmpty();
    }
}
