import { beforeEach, describe, expect, it, vi } from "vitest";
import { endFocusBlock, getFocusBlock } from "../api/focus-block.api";
import { ApiError } from "../api/http";
import type { FocusBlockNative } from "../native/focus-block-plugin";
import type { FocusBlockState } from "../types/focus-block";
import { createFocusBlockController } from "./useFocusBlock";

vi.mock("../api/focus-block.api", () => ({
  getFocusBlock: vi.fn(),
  saveFocusSettings: vi.fn(),
  addFocusEntry: vi.fn(),
  removeFocusEntry: vi.fn(),
  startFocusBlock: vi.fn(),
  endFocusBlock: vi.fn(),
}));

const SERVER_NOW = "2026-11-23T10:00:00.000Z";
const state = (block: FocusBlockState["block"] = null): FocusBlockState => ({
  version: "v1",
  serverNow: SERVER_NOW,
  settings: {
    enabled: true,
    trigger: "stopwatch",
    thresholdMinutes: 15,
    mode: "hardcore",
    listMode: "blocklist",
  },
  block,
  lists: { block: [], allow: [] },
  fixedDomains: [],
});
const hardcore = {
  id: "b",
  title: "Kapitel",
  todoId: 1,
  occurrenceId: null,
  mode: "hardcore" as const,
  listMode: "blocklist" as const,
  startedAt: SERVER_NOW,
  endsAt: "2026-11-23T10:12:00.000Z",
};

function fakeNative() {
  return {
    getStatus: vi.fn(),
    openAccessibilitySettings: vi.fn(),
    requestVpnPermission: vi.fn(),
    listInstalledApps: vi.fn(),
    setBlock: vi.fn().mockResolvedValue(undefined),
    onOpenFocus: vi.fn(() => () => {}),
  } satisfies FocusBlockNative;
}

describe("createFocusBlockController", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  it("hands every answer to the phone and forgets it on sign-out", async () => {
    const native = fakeNative();
    vi.mocked(getFocusBlock).mockResolvedValue(state(hardcore));
    const focus = createFocusBlockController(native);
    await focus.refresh();
    expect(native.setBlock).toHaveBeenCalledWith(state(hardcore));
    focus.dispose();
    expect(native.setBlock).toHaveBeenLastCalledWith(null);
  });

  it("reads the phone's permissions with every refresh and names what is missing", async () => {
    const native = fakeNative();
    native.getStatus.mockResolvedValue({
      accessibilityEnabled: false,
      vpnPrepared: true,
    });
    vi.mocked(getFocusBlock).mockResolvedValue({
      ...state(),
      lists: {
        block: [{ id: 1, kind: "app", value: "com.example", label: null }],
        allow: [],
      },
    });
    const focus = createFocusBlockController(native);
    await focus.refresh();
    expect(focus.setupIssues.value).toEqual(["accessibility"]);
    native.getStatus.mockResolvedValue({
      accessibilityEnabled: true,
      vpnPrepared: true,
    });
    await focus.refresh();
    expect(focus.setupIssues.value).toEqual([]);
  });

  it("counts a Hardcore block down on the server's clock", async () => {
    // The device runs two minutes ahead of the server.
    vi.setSystemTime(Date.parse(SERVER_NOW) + 2 * 60_000);
    vi.mocked(getFocusBlock).mockResolvedValue(state(hardcore));
    const focus = createFocusBlockController(null);
    await focus.refresh();
    expect(focus.minutesLeft.value).toBe(12);
    vi.setSystemTime(Date.parse(SERVER_NOW) + 7 * 60_000);
    focus.tick();
    expect(focus.minutesLeft.value).toBe(7);
  });

  it("keeps the block and says why when lifting Hardcore is refused", async () => {
    vi.mocked(getFocusBlock).mockResolvedValue(state(hardcore));
    vi.mocked(endFocusBlock).mockRejectedValue(
      new ApiError(
        "Eine Hardcore-Sperre endet erst mit dem Soll oder wenn die Quest erledigt ist.",
        409,
        "HARDCORE_BLOCK",
      ),
    );
    const focus = createFocusBlockController(null);
    await focus.refresh();
    expect(await focus.end()).toBe(false);
    expect(focus.block.value?.id).toBe("b");
    expect(focus.error.value).toContain("Hardcore-Sperre");
  });
});
