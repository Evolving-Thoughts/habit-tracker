/** "12:05" or "1:02:05": a time worked, in whole seconds that have passed. */
export function formatStopwatch(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const pad = (value: number): string => String(value).padStart(2, "0");
  const rest = `${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
  return hours ? `${hours}:${rest}` : rest;
}
