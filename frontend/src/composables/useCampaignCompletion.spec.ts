import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import { useCampaignCompletion } from "./useCampaignCompletion";

vi.mock("../api/todo-hierarchy.api", () => ({ getTodoHierarchy: vi.fn() }));

function setup() {
  let api!: ReturnType<typeof useCampaignCompletion>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useCampaignCompletion();
        return () => h("div");
      },
    }),
  );
  return { wrapper, api };
}

describe("useCampaignCompletion", () => {
  it("goes ahead at once without open quests below", async () => {
    const { api } = setup();
    await expect(api.confirm("Buch", 0)).resolves.toBe(true);
    expect(api.question.value).toBeNull();
  });

  it("asks with the open quests and goes ahead on the answer", async () => {
    const { api } = setup();
    const yes = api.confirm("Buch", 3);
    expect(api.question.value).toEqual({ title: "Buch", open: 3 });
    api.reply(true);
    await expect(yes).resolves.toBe(true);
    expect(api.question.value).toBeNull();

    const no = api.confirm("Buch", 3);
    api.reply(false);
    await expect(no).resolves.toBe(false);
  });

  it("drops an unanswered question when the view goes", async () => {
    const { api, wrapper } = setup();
    const pending = api.confirm("Buch", 1);
    wrapper.unmount();
    await expect(pending).resolves.toBe(false);
  });

  it("counts the open quests below from the server's tree", async () => {
    vi.mocked(getTodoHierarchy).mockResolvedValueOnce([
      {
        id: 7,
        progress: { todoCount: 4, doneCount: 1 },
      } as never,
    ]);
    const { api } = setup();
    await expect(api.openQuestsBelow(7)).resolves.toBe(3);
  });

  it("asks nothing when the tree cannot be read", async () => {
    vi.mocked(getTodoHierarchy).mockRejectedValueOnce(new Error("Offline"));
    const { api } = setup();
    await expect(api.openQuestsBelow(7)).resolves.toBe(0);
  });
});
