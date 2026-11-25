import { readonly, ref, type Ref } from "vue";
import { whileActive } from "./useActive";

/** Where a quest from a quick add joins its list: at the head or the end. */
export type InsertPlace = "top" | "bottom";

const STORAGE_KEY = "quickAdd:place";

function stored(): InsertPlace {
  try {
    return localStorage.getItem(STORAGE_KEY) === "top" ? "top" : "bottom";
  } catch {
    return "bottom";
  }
}

/* One choice per device, shared by every quick add on the page. */
const place = ref<InsertPlace>("bottom");
let users = 0;

/**
 * The device's choice of where new quests from a quick add go (↑ / ↓ beside
 * the field on Heute and in the Questlog, once in the Plan's head;
 * `InsertPlaceToggle`). All fields on the page share it; the first one to appear reads it from storage again, so a
 * choice made in another tab holds the next time a view opens. A field of
 * kept-alive Heute counts only while Heute is shown.
 */
export function useInsertPlace(): {
  place: Readonly<Ref<InsertPlace>>;
  choose: (next: InsertPlace) => void;
} {
  whileActive(
    () => {
      if (users === 0) place.value = stored();
      users += 1;
    },
    () => {
      users -= 1;
    },
    { immediate: true },
  );
  function choose(next: InsertPlace): void {
    place.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Without storage the choice lasts until the page is left.
    }
  }
  return { place: readonly(place), choose };
}
