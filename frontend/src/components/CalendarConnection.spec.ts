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

  it("stays hidden until Google is set up", async () => {
    vi.mocked(getCalendarStatus).mockResolvedValue({
      ...status,
      configured: false,
    });
    const wrapper = mount(CalendarConnection);
    await flushPromises();
    expect(wrapper.find("section").exists()).toBe(false);
  });

  it("offers connecting, also after access was withdrawn", async () => {
    vi.mocked(getCalendarStatus).mockResolvedValue({
      ...status,
      revoked: true,
    });
    const wrapper = mount(CalendarConnection);
    await flushPromises();
    expect(wrapper.text()).toContain("neu verbinden");
    expect(wrapper.find("button").text()).toBe("Verbinden");
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
