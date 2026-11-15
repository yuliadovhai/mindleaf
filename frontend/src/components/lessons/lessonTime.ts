import { isoToLocalInput } from "../../lib/datetime";
import type { Lesson } from "../../api/types";

/** Kyiv wall-clock parts of a lesson: date "YYYY-MM-DD" and minutes since midnight. */
export function lessonClock(lesson: Lesson): { date: string; minutes: number } {
  const local = isoToLocalInput(lesson.starts_at);
  const [hh, mm] = local.slice(11, 16).split(":").map(Number);
  return { date: local.slice(0, 10), minutes: hh * 60 + mm };
}

/** A planned lesson that already started and still needs a mark. */
export function needsMark(lesson: Lesson, now = Date.now()): boolean {
  return lesson.status === "planned" && new Date(lesson.starts_at).getTime() <= now;
}

/** Monday of the week that contains `date` ("YYYY-MM-DD"). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const shift = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

const DAY = new Intl.DateTimeFormat("uk-UA", { weekday: "short", timeZone: "UTC" });
const DAY_LONG = new Intl.DateTimeFormat("uk-UA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const DAY_MONTH = new Intl.DateTimeFormat("uk-UA", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

const utc = (date: string) => new Date(`${date}T00:00:00Z`);

/** "пн" */
export const weekdayShort = (date: string) => DAY.format(utc(date));
/** "Понеділок, 16 листопада" */
export function dayLong(date: string): string {
  const text = DAY_LONG.format(utc(date));
  return text.charAt(0).toUpperCase() + text.slice(1);
}
/** "16 листопада" */
export const dayMonth = (date: string) => DAY_MONTH.format(utc(date));

/** "16–22 листопада 2026" or "30 листопада – 6 грудня 2026" */
export function weekLabel(start: string, end: string): string {
  const year = end.slice(0, 4);
  if (start.slice(5, 7) === end.slice(5, 7)) {
    return `${Number(start.slice(8))}–${dayMonth(end)} ${year}`;
  }
  return `${dayMonth(start)} – ${dayMonth(end)} ${year}`;
}

export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
