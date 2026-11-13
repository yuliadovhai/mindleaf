const TZ = "Europe/Kyiv";

/** ISO datetime рядок → локальний рядок дата+час (наприклад "13.11.2026 16:00") */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO datetime рядок → "16:00" */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("uk-UA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO datetime рядок → "13.11.2026" */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uk-UA", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Поточна дата в Києві у форматі YYYY-MM-DD */
export function todayKyiv(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** datetime-local value ("2026-11-13T16:00") → ISO рядок з офсетом Києва */
export function localInputToIso(value: string): string {
  if (!value) return "";
  const kyivOffset = getKyivOffsetMinutes(new Date(value));
  const sign = kyivOffset >= 0 ? "+" : "-";
  const abs = Math.abs(kyivOffset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${value}:00${sign}${hh}:${mm}`;
}

/** ISO рядок → datetime-local value ("2026-11-13T16:00") у часовому поясі Києва */
export function isoToLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/** YYYY-MM-DD → YYYY-MM-DD, shifted by n days (pure UTC, no timezone drift) */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function getKyivOffsetMinutes(d: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    timeZoneName: "longOffset",
  }).formatToParts(d);
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  // "GMT+03:00", "GMT+02:00", "GMT+0" (UTC)
  const match = tzPart.match(/GMT([+-])(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  const sign = match[1] === "+" ? 1 : -1;
  return sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
}
