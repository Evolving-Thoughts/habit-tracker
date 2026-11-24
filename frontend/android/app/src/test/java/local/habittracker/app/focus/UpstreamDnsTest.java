package local.habittracker.app.focus;

import static org.junit.Assert.assertEquals;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.Test;

public class UpstreamDnsTest {
    private static InetAddress ip(String literal) {
        try {
            // Literals only: no lookup happens.
            return InetAddress.getByName(literal);
        } catch (UnknownHostException error) {
            throw new AssertionError(error);
        }
    }

    private static UpstreamDns.Network network(boolean vpn, boolean internet, String... servers) {
        InetAddress[] addresses = new InetAddress[servers.length];
        for (int i = 0; i < servers.length; i++) addresses[i] = ip(servers[i]);
        return new UpstreamDns.Network(vpn, internet, Arrays.asList(addresses));
    }

    @Test
    public void putsIpv4BeforeIpv6AndKeepsTheOrderWithin() {
        List<InetAddress> servers = UpstreamDns.select(Arrays.asList(
            network(false, true, "2001:4860:4860::8888", "192.168.1.1", "fd00::1", "192.168.1.2")
        ));
        assertEquals(
            Arrays.asList(ip("192.168.1.1"), ip("192.168.1.2"), ip("2001:4860:4860::8888"), ip("fd00::1")),
            servers
        );
    }

    @Test
    public void ignoresVpnNetworks() {
        List<InetAddress> servers = UpstreamDns.select(Arrays.asList(
            network(true, true, "10.111.222.2"),
            network(false, true, "192.168.1.1")
        ));
        assertEquals(Collections.singletonList(ip("192.168.1.1")), servers);
    }

    @Test
    public void ignoresNetworksWithoutInternet() {
        List<InetAddress> servers = UpstreamDns.select(Arrays.asList(
            network(false, false, "192.168.49.1"),
            network(false, true, "10.0.0.1")
        ));
        assertEquals(Collections.singletonList(ip("10.0.0.1")), servers);
    }

    @Test
    public void fallsBackToQuad9WithoutAnyServer() {
        assertEquals(Collections.singletonList(ip("9.9.9.9")), UpstreamDns.select(Collections.<UpstreamDns.Network>emptyList()));
        assertEquals(
            Collections.singletonList(ip("9.9.9.9")),
            UpstreamDns.select(Arrays.asList(network(true, true, "10.111.222.2"), network(false, false, "192.168.49.1"), network(false, true)))
        );
    }

    @Test
    public void removesDuplicatesAcrossNetworks() {
        List<InetAddress> servers = UpstreamDns.select(Arrays.asList(
            network(false, true, "192.168.1.1", "fd00::1", "192.168.1.1"),
            network(false, true, "fd00::1", "192.168.1.1", "8.8.8.8")
        ));
        assertEquals(Arrays.asList(ip("192.168.1.1"), ip("8.8.8.8"), ip("fd00::1")), servers);
    }
}
