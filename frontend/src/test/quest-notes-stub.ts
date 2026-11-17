import { defineComponent, h } from "vue";

/**
 * Stands in for QuestNotes.vue in the specs of the views that show it:
 * `vi.mock("../components/QuestNotes.vue", () => import("../test/quest-notes-stub"))`.
 * The notes have their own spec; a host only decides which quest they belong to.
 */
export default defineComponent({
  name: "QuestNotes",
  props: { todoId: { type: Number, required: true } },
  setup: (props) => () => h("div", { "data-notes": props.todoId }),
});
