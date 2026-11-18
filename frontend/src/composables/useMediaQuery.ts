import { onBeforeUnmount, ref, type Ref } from "vue";

/**
 * Whether a media query matches now, kept current. Without `matchMedia`
 * (tests, old browsers) it never matches, so the narrow layout applies.
 */
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const matches = ref(false);
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return matches;
  const list = window.matchMedia(query);
  matches.value = list.matches;
  const update = (event: MediaQueryListEvent) =>
    (matches.value = event.matches);
  list.addEventListener?.("change", update);
  onBeforeUnmount(() => list.removeEventListener?.("change", update));
  return matches;
}
