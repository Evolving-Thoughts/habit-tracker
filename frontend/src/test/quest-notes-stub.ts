import { defineComponent, h, type PropType } from "vue";

/**
 * Stands in for QuestNotes.vue in the specs of the views that show it:
 * `vi.mock("../components/QuestNotes.vue", () => import("../test/quest-notes-stub"))`.
 * The notes have their own spec; a host only decides whose notes they are,
 * shown as "todo-4" or "occurrence-20".
 */
export default defineComponent({
  name: "QuestNotes",
  props: {
    target: {
      type: Object as PropType<{ kind: "todo" | "occurrence"; id: number }>,
      required: true,
    },
  },
  setup: (props) => () =>
    h("div", { "data-notes": `${props.target.kind}-${props.target.id}` }),
});
