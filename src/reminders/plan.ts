import { Item } from '../types';

/**
 * Reminders on saved items. Pure functions only (no native modules), so they test alone.
 *
 * A reminder is `item.meta.reminder.at`. The vault is the source of truth; the phone's scheduled
 * notifications are a copy that `planReminderSync` brings back in line after any change, restore or
 * reinstall. Notification text never contains the item, because the lock screen is not private.
 */

export const REMINDER_PREFIX = 'forward-reminder:';
/** iOS keeps at most 64 pending local notifications per app; stay under it, soonest first. */
export const MAX_SCHEDULED = 60;

export function reminderId(itemId: string): string {
  return REMINDER_PREFIX + itemId;
}

export type Scheduled = { identifier: string; itemId: string; at: number };
export type SyncPlan = { schedule: { itemId: string; at: number }[]; cancel: string[] };

const activeReminder = (item: Item): number | null =>
  !item.trashedAt && typeof item.meta.reminder?.at === 'number' && Number.isFinite(item.meta.reminder.at)
    ? item.meta.reminder.at
    : null;

/**
 * What to schedule and cancel so the phone matches the vault. Only touches Forward's own reminder
 * notifications; anything without the prefix is left alone.
 */
export function planReminderSync(items: Item[], scheduled: Scheduled[], now: number): SyncPlan {
  const wanted = items
    .map(item => ({ itemId: item.id, at: activeReminder(item) }))
    .filter((r): r is { itemId: string; at: number } => r.at !== null && r.at > now)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_SCHEDULED);
  const wantedAt = new Map(wanted.map(r => [r.itemId, r.at]));
  const ours = scheduled.filter(s => s.identifier.startsWith(REMINDER_PREFIX));
  const have = new Map(ours.map(s => [s.itemId, s.at]));
  return {
    schedule: wanted.filter(r => have.get(r.itemId) !== r.at),
    cancel: ours.filter(s => wantedAt.get(s.itemId) !== s.at).map(s => s.identifier),
  };
}

/** Items whose reminder time has come, oldest first, and the next ones coming up. */
export function reminderLists(items: Item[], now: number): { due: Item[]; upcoming: Item[] } {
  const withTime = items
    .map(item => ({ item, at: activeReminder(item) }))
    .filter((r): r is { item: Item; at: number } => r.at !== null)
    .sort((a, b) => a.at - b.at);
  return {
    due: withTime.filter(r => r.at <= now).map(r => r.item),
    upcoming: withTime.filter(r => r.at > now).map(r => r.item),
  };
}

export type Preset = { key: string; label: string; at: number };

const at = (base: Date, dayOffset: number, hour: number, minute = 0) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute, 0, 0).getTime();

/** Quick choices, in local time. Choices that would already be past (or too soon) are left out. */
export function reminderPresets(now: Date): Preset[] {
  const t = now.getTime();
  const out: Preset[] = [];
  const later = new Date(t + 3 * 3600_000);
  later.setMinutes(0, 0, 0);
  if (later.getDate() === now.getDate() && later.getHours() < 21 && later.getHours() >= 8) {
    out.push({ key: 'later', label: 'Later today', at: later.getTime() });
  }
  if (now.getHours() < 17) out.push({ key: 'evening', label: 'This evening', at: at(now, 0, 19) });
  out.push({ key: 'tomorrow', label: 'Tomorrow morning', at: at(now, 1, 9) });
  const day = now.getDay(); // 0 Sunday … 6 Saturday
  const toSaturday = (6 - day + 7) % 7 || 7;
  if (toSaturday > 1) out.push({ key: 'weekend', label: 'This weekend', at: at(now, toSaturday, 10) });
  const toMonday = (1 - day + 7) % 7 || 7;
  out.push({ key: 'week', label: 'Next week', at: at(now, toMonday, 9) });
  // Same day next month, or its last day (31 Jan → 28/29 Feb).
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate();
  const month = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(now.getDate(), lastDay), 9).getTime();
  out.push({ key: 'month', label: 'In a month', at: month });
  return out.filter(p => p.at > t + 10 * 60_000);
}

/** Snooze from a due reminder: tomorrow at 9, or in an hour when it is still early morning. */
export function snoozeTime(now: Date): number {
  return now.getHours() < 7 ? at(now, 0, 9) : at(now, 1, 9);
}

const pad = (n: number) => String(n).padStart(2, '0');
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clock(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${h}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** "Today, 7:00 PM", "Tomorrow, 9:00 AM", "Sat 23 Nov, 10:00 AM" (with the year when it differs). */
export function formatReminder(atMs: number, now: Date): string {
  const d = new Date(atMs);
  const dayDiff = Math.round((at(d, 0, 0) - at(now, 0, 0)) / 86400_000);
  const day =
    dayDiff === 0 ? 'Today'
    : dayDiff === 1 ? 'Tomorrow'
    : dayDiff === -1 ? 'Yesterday'
    : `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
  return `${day}, ${clock(d)}`;
}
