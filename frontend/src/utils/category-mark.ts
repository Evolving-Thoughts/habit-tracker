/**
 * Categories have no stored colour, so each name maps to one of a few quiet
 * marks. The same name always gets the same mark; none of them is the action
 * colour, so orange still means "tap here".
 */
const MARKS = [
  "#6d8b5a", // moss
  "#4f7c99", // slate blue
  "#9a6b9e", // heather
  "#b08a3e", // ochre
  "#5f8f87", // sage teal
  "#8c6b55", // walnut
];

export function categoryMark(name: string): string {
  let hash = 0;
  for (const character of name)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return MARKS[hash % MARKS.length]!;
}
