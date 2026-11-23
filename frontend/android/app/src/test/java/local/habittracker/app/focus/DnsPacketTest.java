package local.habittracker.app.focus;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class DnsPacketTest {
    private static final byte[] PHONE = {10, 111, (byte) 222, 1};
    private static final byte[] FAKE_DNS = {10, 111, (byte) 222, 2};

    /**
     * An IPv4/UDP packet from the phone's browser (port 40000) to the fake
     * DNS server: reply() swaps both ends of the query it is given.
     */
    private static byte[] packet(byte[] dns) {
        return DnsPacket.reply(new DnsPacket.Query(FAKE_DNS, PHONE, 53, 40000, dns, ""), dns);
    }

    @Test
    public void readsTheQueriedName() {
        byte[] dns = DnsPacket.query(0x1234, "M.YouTube.com");
        byte[] request = packet(dns);
        DnsPacket.Query query = DnsPacket.parse(request, request.length);
        assertNotNull(query);
        assertEquals("m.youtube.com", query.name);
        assertEquals(40000, query.sourcePort);
        assertEquals(53, query.destinationPort);
        assertArrayEquals(PHONE, query.sourceAddress);
        assertArrayEquals(FAKE_DNS, query.destinationAddress);
        assertArrayEquals(dns, query.dns);
    }

    @Test
    public void ignoresWhatIsNoDnsQuery() {
        assertNull(DnsPacket.parse(new byte[10], 10));
        byte[] request = packet(DnsPacket.query(1, "example.com"));
        // TCP instead of UDP.
        byte[] tcp = request.clone();
        tcp[9] = 6;
        assertNull(DnsPacket.parse(tcp, tcp.length));
        // An answer, not a question.
        byte[] answer = request.clone();
        answer[28 + 2] |= (byte) 0x80;
        assertNull(DnsPacket.parse(answer, answer.length));
        // IPv6.
        byte[] six = request.clone();
        six[0] = 0x60;
        assertNull(DnsPacket.parse(six, six.length));
    }

    @Test
    public void answersABlockedNameWithNxdomain() {
        byte[] dns = DnsPacket.query(0xbeef, "reddit.com");
        byte[] answer = DnsPacket.nxdomain(dns);
        assertEquals(dns.length, answer.length);
        assertEquals((byte) 0xbe, answer[0]);
        assertEquals((byte) 0xef, answer[1]);
        // QR set, RD kept.
        assertEquals((byte) 0x81, answer[2]);
        // RA set, RCODE 3.
        assertEquals((byte) 0x83, answer[3]);
        assertEquals(1, answer[5]);
        assertEquals(0, answer[7]);
        assertEquals("reddit.com", DnsPacket.readName(answer, 12));
    }

    @Test
    public void wrapsTheAnswerForTheAskingApp() {
        byte[] request = packet(DnsPacket.query(7, "example.com"));
        DnsPacket.Query query = DnsPacket.parse(request, request.length);
        byte[] dns = DnsPacket.nxdomain(query.dns);
        byte[] reply = DnsPacket.reply(query, dns);
        assertEquals(28 + dns.length, reply.length);
        assertEquals(0x45, reply[0]);
        assertEquals(17, reply[9]);
        // From the fake DNS server back to the phone, port 53 to the asking port.
        assertArrayEquals(FAKE_DNS, new byte[] {reply[12], reply[13], reply[14], reply[15]});
        assertArrayEquals(PHONE, new byte[] {reply[16], reply[17], reply[18], reply[19]});
        assertEquals(53, ((reply[20] & 0xff) << 8) | (reply[21] & 0xff));
        assertEquals(40000, ((reply[22] & 0xff) << 8) | (reply[23] & 0xff));
        // A valid header checksum sums to zero.
        assertEquals(0, DnsPacket.checksum(reply, 0, 20));
    }
}
