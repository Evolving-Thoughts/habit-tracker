package local.habittracker.app.focus;

import java.io.ByteArrayOutputStream;

/**
 * The few bytes of IPv4, UDP and DNS the website filter needs: read the
 * name a query asks for, answer a blocked one with NXDOMAIN, and wrap an
 * upstream answer back into a packet for the app that asked. Nothing else
 * of a packet is read or kept. No Android types, so it runs in JVM tests.
 */
public final class DnsPacket {
    private DnsPacket() {}

    /** One DNS query read from an IPv4/UDP packet of the VPN interface. */
    public static final class Query {
        public final byte[] sourceAddress;
        public final byte[] destinationAddress;
        public final int sourcePort;
        public final int destinationPort;
        /** The DNS message (UDP payload). */
        public final byte[] dns;
        /** The first question's name, lower case, without the final dot. */
        public final String name;

        Query(byte[] source, byte[] destination, int sourcePort, int destinationPort, byte[] dns, String name) {
            this.sourceAddress = source;
            this.destinationAddress = destination;
            this.sourcePort = sourcePort;
            this.destinationPort = destinationPort;
            this.dns = dns;
            this.name = name;
        }
    }

    /** The query in this packet, or null for anything that is no DNS query over IPv4/UDP. */
    public static Query parse(byte[] packet, int length) {
        if (length < 20) return null;
        int version = (packet[0] >> 4) & 0x0f;
        if (version != 4) return null;
        int headerLength = (packet[0] & 0x0f) * 4;
        if (headerLength < 20 || length < headerLength + 8) return null;
        int protocol = packet[9] & 0xff;
        if (protocol != 17) return null;
        int totalLength = u16(packet, 2);
        if (totalLength > length || totalLength < headerLength + 8) return null;
        byte[] source = copy(packet, 12, 4);
        byte[] destination = copy(packet, 16, 4);
        int udp = headerLength;
        int sourcePort = u16(packet, udp);
        int destinationPort = u16(packet, udp + 2);
        int udpLength = u16(packet, udp + 4);
        if (udpLength < 8 || udp + udpLength > totalLength) return null;
        byte[] dns = copy(packet, udp + 8, udpLength - 8);
        if (dns.length < 12) return null;
        boolean isResponse = (dns[2] & 0x80) != 0;
        int questions = u16(dns, 4);
        if (isResponse || questions < 1) return null;
        String name = readName(dns, 12);
        if (name == null) return null;
        return new Query(source, destination, sourcePort, destinationPort, dns, name);
    }

    /** The first question's name, or null when it does not parse. */
    static String readName(byte[] dns, int offset) {
        StringBuilder name = new StringBuilder();
        int position = offset;
        int labels = 0;
        while (true) {
            if (position >= dns.length) return null;
            int length = dns[position] & 0xff;
            if (length == 0) break;
            // A question name carries no compression pointers.
            if ((length & 0xc0) != 0 || length > 63) return null;
            if (position + 1 + length > dns.length) return null;
            if (++labels > 127) return null;
            if (name.length() > 0) name.append('.');
            for (int i = 0; i < length; i++) {
                char c = (char) (dns[position + 1 + i] & 0xff);
                name.append(Character.toLowerCase(c));
            }
            position += 1 + length;
        }
        return name.toString();
    }

    /** Where the question section ends (after QTYPE and QCLASS), or -1. */
    static int questionEnd(byte[] dns) {
        int position = 12;
        while (position < dns.length) {
            int length = dns[position] & 0xff;
            if (length == 0) {
                int end = position + 1 + 4;
                return end <= dns.length ? end : -1;
            }
            if ((length & 0xc0) != 0) return -1;
            position += 1 + length;
        }
        return -1;
    }

    /**
     * The NXDOMAIN answer to a query: same id and question, "recursion
     * available", no records. A browser then shows that the site cannot
     * be reached.
     */
    public static byte[] nxdomain(byte[] query) {
        int end = questionEnd(query);
        if (end < 0) end = 12;
        byte[] answer = new byte[end];
        System.arraycopy(query, 0, answer, 0, end);
        // QR = 1, keep opcode and RD; RA = 1, RCODE = 3 (NXDOMAIN).
        answer[2] = (byte) (0x80 | (query[2] & 0x79));
        answer[3] = (byte) 0x83;
        // One question (if it parsed), no answers, no authority, no additional.
        answer[4] = 0;
        answer[5] = (byte) (end > 12 ? 1 : 0);
        for (int i = 6; i < 12; i++) answer[i] = 0;
        return answer;
    }

    /** An IPv4/UDP packet carrying `dns` back from the query's destination to its source. */
    public static byte[] reply(Query query, byte[] dns) {
        int total = 20 + 8 + dns.length;
        byte[] packet = new byte[total];
        packet[0] = 0x45;
        packet[2] = (byte) (total >> 8);
        packet[3] = (byte) total;
        // Don't fragment.
        packet[6] = 0x40;
        packet[8] = 64;
        packet[9] = 17;
        System.arraycopy(query.destinationAddress, 0, packet, 12, 4);
        System.arraycopy(query.sourceAddress, 0, packet, 16, 4);
        int checksum = checksum(packet, 0, 20);
        packet[10] = (byte) (checksum >> 8);
        packet[11] = (byte) checksum;
        int udp = 20;
        packet[udp] = (byte) (query.destinationPort >> 8);
        packet[udp + 1] = (byte) query.destinationPort;
        packet[udp + 2] = (byte) (query.sourcePort >> 8);
        packet[udp + 3] = (byte) query.sourcePort;
        int udpLength = 8 + dns.length;
        packet[udp + 4] = (byte) (udpLength >> 8);
        packet[udp + 5] = (byte) udpLength;
        // UDP checksum 0: none, allowed over IPv4.
        System.arraycopy(dns, 0, packet, udp + 8, dns.length);
        return packet;
    }

    /** The Internet checksum (RFC 1071) of a range. */
    static int checksum(byte[] data, int offset, int length) {
        long sum = 0;
        int i = offset;
        int end = offset + length;
        while (i + 1 < end) {
            sum += ((data[i] & 0xff) << 8) | (data[i + 1] & 0xff);
            i += 2;
        }
        if (i < end) sum += (data[i] & 0xff) << 8;
        while ((sum >> 16) != 0) sum = (sum & 0xffff) + (sum >> 16);
        return (int) (~sum & 0xffff);
    }

    /** A DNS query for `name` (for tests and the self-check). */
    public static byte[] query(int id, String name) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(id >> 8);
        out.write(id);
        out.write(0x01);
        out.write(0x00);
        out.write(0);
        out.write(1);
        for (int i = 0; i < 6; i++) out.write(0);
        for (String label : name.split("\\.")) {
            out.write(label.length());
            for (char c : label.toCharArray()) out.write(c);
        }
        out.write(0);
        out.write(0);
        out.write(1);
        out.write(0);
        out.write(1);
        return out.toByteArray();
    }

    private static int u16(byte[] data, int offset) {
        return ((data[offset] & 0xff) << 8) | (data[offset + 1] & 0xff);
    }

    private static byte[] copy(byte[] data, int offset, int length) {
        byte[] result = new byte[length];
        System.arraycopy(data, offset, result, 0, length);
        return result;
    }
}
