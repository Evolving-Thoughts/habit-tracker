import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CalendarConnection from "./CalendarConnection.vue";
import {
  disconnectCalendar,
  getCalendarStatus,
  syncCalendar,
} from "../api/calendar.api";

vi.mock("../api/calendar.api", () => ({
  disconnectCalendar: vi.fn(),
  getCalendarStatus: vi.fn(),
  startCalendarConnection: vi.fn(),
  syncCalendar: vi.fn(),
}));

const status = {
  configured: true,
  connected: false,
  revoked: false,
  lastSyncedAt: null,
  lastError: null,
};

describe("CalendarConnection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("says so while Google is not set up", async () => {
    vi.mocked(getCalendarStatus).mockResolvedValue({
      ...status,
      configured: false,
    });
    const wrapper = mount(CalendarConnection);
    await flushPromises();
    expect(wrapper.find("section").exists()).toBe(false);
    expect(wrapper.text()).toContain("nicht eingerichtet");
    expect(wrapper.text()).toContain("fehlen die Google-Zugangsdaten");
    expect(wrapper.text()).toContain("docs/betrieb.md");
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("offers connecting, also after access was withdrawn", async () => {
    vi.mocked(getCalendarStatus).mockResolvedValue({
      ...status,
      revoked: true,
    });
    const wrapper = mount(CalendarConnection);
    await flushPromises();
    expect(wrapper.text()).toContain("neu verbinden");
    const connect = wrapper.get("button");
    expect(connect.text()).toBe("Verbinden");
    // What happens next is said before it happens.
    expect(
      wrapper.get(`#${connect.attributes("aria-describedby")}`).text(),
    ).toContain("schreibt nie in deine anderen Kalender");
  });

  it("lists the calendars it reads and says where it writes", async () => {
    vi.mocked(getCalendarStatus).mockResolvedValue({
      ...status,
      connected: true,
      calendars: [{ id: "shared", title: "Gemeinsam", primary: false }],
    });
    const wrapper = mount(CalendarConnection);
    await flushPromises();
    expect(wrapper.get("li").text()).toBe("Gemeinsam");
    expect(wrapper.text()).toContain(
      "Geschrieben wird nur in den eigenen Kalender",
    );
    // Reading a calendar is no setting any more.
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
  });

  it("offers renewing permissions for an older connection", async () => {
    vi.mocked(getCalendarStatus).mockResolvedValue({
      ...status,
      connected: true,
      needsConsent: true,
    });
    const wrapper = mount(CalendarConnection);
    await flushPromises();
    expect(wrapper.text()).toContain("Berechtigungen erneuern");
  });

  it("syncs on demand and disconnects after confirming", async () => {
    vi.mocked(getCalendarStatus).mockResolvedValue({
      ...status,
      connected: true,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const wrapper = mount(CalendarConnection);
    await flushPromises();
    const [sync, disconnect] = wrapper.findAll("button");
    await sync.trigger("click");
    await flushPromises();
    expect(syncCalendar).toHaveBeenCalled();
    await disconnect.trigger("click");
    await flushPromises();
    expect(disconnectCalendar).toHaveBeenCalled();
  });
});
