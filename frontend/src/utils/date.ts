export function formatDateForGermanDisplay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");

  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  return `${day}.${month}.${year}`;
}

export function formatTimeForGermanDisplay(isoDateTime: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDateTime));
}
