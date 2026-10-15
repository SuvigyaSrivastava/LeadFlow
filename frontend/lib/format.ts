import type { FollowUpState } from "@/types";

export const DEFAULT_TIMEZONE = "Asia/Kolkata";
export const DEFAULT_FOLLOW_UP_TIME = "09:00";

const pad = (n: number) => String(n).padStart(2, "0");

function parts(date: Date, timeZone: string) {
  const out: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)) {
    out[p.type] = p.value;
  }
  return out as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

/** Date and time of an instant on the wall clock of `timeZone`. */
export function localParts(input: string | Date, timeZone: string) {
  const p = parts(typeof input === "string" ? new Date(input) : input, timeZone);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export const nowLocal = (timeZone: string, now: Date = new Date()) => localParts(now, timeZone);

/** "YYYY-MM-DDTHH:mm" without an offset. The API reads it in its configured timezone. */
export const combineLocal = (date: string, time: string = DEFAULT_FOLLOW_UP_TIME) =>
  `${date}T${time || DEFAULT_FOLLOW_UP_TIME}`;

/** Minute resolution, mirroring the API's one-minute grace for "in the past". */
export function isPastLocal(naive: string, timeZone: string, now: Date = new Date()): boolean {
  const n = nowLocal(timeZone, now);
  return naive < `${n.date}T${n.time}`;
}

export function addDays(date: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatDateTime(iso: string, timeZone: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const sameYear = parts(date, timeZone).year === parts(now, timeZone).year;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export const formatTime = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );

export const formatDay = (iso: string, timeZone: string, now: Date = new Date()) => {
  const date = new Date(iso);
  const sameYear = parts(date, timeZone).year === parts(now, timeZone).year;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
};

function plural(n: number, unit: string) {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** Whole-unit duration such as "3 hours" or "2 days". */
export function durationLabel(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return plural(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 14) return plural(days, "day");
  if (days < 60) return plural(Math.floor(days / 7), "week");
  return plural(Math.floor(days / 30), "month");
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  return `${durationLabel(diff)} ago`;
}

/** Short, scannable description of when a pending follow-up is due. */
export function followUpLabel(
  iso: string,
  state: FollowUpState,
  timeZone: string,
  now: Date = new Date(),
): string {
  if (state === "overdue") return `Overdue ${durationLabel(now.getTime() - new Date(iso).getTime())}`;
  if (state === "today") return `Today, ${formatTime(iso, timeZone)}`;
  return formatDateTime(iso, timeZone, now);
}

export { pad };
