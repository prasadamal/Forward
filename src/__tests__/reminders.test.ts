import {
  formatReminder,
  MAX_SCHEDULED,
  planReminderSync,
  reminderId,
  reminderLists,
  reminderPresets,
  snoozeTime,
} from '../reminders/plan';
import { Item } from '../types';

const item = (id: string, at?: number, extra: Partial<Item> = {}): Item => ({
  id,
  type: 'link',
  title: id,
  text: '',
  source: 'web',
  tags: [],
  folderIds: [],
  pinned: false,
  sensitive: false,
  filing: 'auto',
  meta: at === undefined ? {} : { reminder: { at } },
  hasThumb: false,
  hasBlob: false,
  createdAt: 0,
  updatedAt: 0,
  ...extra,
});
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('planReminderSync', () => {
  const now = 1_000_000;

  it('schedules new future reminders and leaves matching ones alone', () => {
    const plan = planReminderSync(
      [item('a', now + 10), item('b', now + 20), item('c')],
      [{ identifier: reminderId('a'), itemId: 'a', at: now + 10 }],
      now,
    );
    expect(plan).toEqual({ schedule: [{ itemId: 'b', at: now + 20 }], cancel: [] });
  });

  it('reschedules a changed time and cancels cleared, trashed, deleted and past reminders', () => {
    const plan = planReminderSync(
      [item('moved', now + 50), item('cleared'), item('trashed', now + 5, { trashedAt: 1 }), item('past', now - 1)],
      [
        { identifier: reminderId('moved'), itemId: 'moved', at: now + 10 },
        { identifier: reminderId('cleared'), itemId: 'cleared', at: now + 10 },
        { identifier: reminderId('trashed'), itemId: 'trashed', at: now + 5 },
        { identifier: reminderId('deleted'), itemId: 'deleted', at: now + 5 },
        { identifier: reminderId('past'), itemId: 'past', at: now - 1 },
      ],
      now,
    );
    expect(plan.schedule).toEqual([{ itemId: 'moved', at: now + 50 }]);
    expect(plan.cancel.sort()).toEqual(
      ['moved', 'cleared', 'trashed', 'deleted', 'past'].map(reminderId).sort(),
    );
  });

  it('never touches notifications that are not Forward reminders', () => {
    const plan = planReminderSync([], [{ identifier: 'something-else', itemId: '', at: now + 1 }], now);
    expect(plan.cancel).toEqual([]);
  });

  it('keeps under the iOS limit by scheduling the soonest reminders first', () => {
    const many = Array.from({ length: MAX_SCHEDULED + 5 }, (_, i) => item(`i${i}`, now + 1000 - i));
    const plan = planReminderSync(many, [], now);
    expect(plan.schedule).toHaveLength(MAX_SCHEDULED);
    expect(plan.schedule[0]).toEqual({ itemId: `i${MAX_SCHEDULED + 4}`, at: now + 1000 - (MAX_SCHEDULED + 4) });
  });
});

describe('reminderLists', () => {
  it('splits due (oldest first) from upcoming (soonest first), ignoring trashed items', () => {
    const now = 500;
    const { due, upcoming } = reminderLists(
      [item('later', 900), item('old', 100), item('soon', 600), item('recent', 400), item('bin', 50, { trashedAt: 1 }), item('none')],
      now,
    );
    expect(due.map(i => i.id)).toEqual(['old', 'recent']);
    expect(upcoming.map(i => i.id)).toEqual(['soon', 'later']);
  });
});

describe('reminderPresets', () => {
  const keys = (d: Date) => reminderPresets(d).map(p => p.key);

  it('on a weekday morning offers the whole set at sensible local times', () => {
    const wed = new Date(2026, 10, 18, 9, 15); // Wednesday
    const presets = reminderPresets(wed);
    expect(presets.map(p => p.key)).toEqual(['later', 'evening', 'tomorrow', 'weekend', 'week', 'month']);
    const atOf = (k: string) => presets.find(p => p.key === k)!.at;
    expect(atOf('later')).toBe(local(2026, 11, 18, 12));
    expect(atOf('evening')).toBe(local(2026, 11, 18, 19));
    expect(atOf('tomorrow')).toBe(local(2026, 11, 19, 9));
    expect(atOf('weekend')).toBe(local(2026, 11, 21, 10));
    expect(atOf('week')).toBe(local(2026, 11, 23, 9));
    expect(atOf('month')).toBe(local(2026, 12, 18, 9));
  });

  it('drops choices that are past or pointless', () => {
    expect(keys(new Date(2026, 10, 18, 20, 0))).toEqual(['tomorrow', 'weekend', 'week', 'month']);
    // Friday: tomorrow is already Saturday, so "This weekend" would repeat "Tomorrow".
    expect(keys(new Date(2026, 10, 20, 22, 0))).toEqual(['tomorrow', 'week', 'month']);
    // Late night: "Later today" would land after 9 PM.
    expect(keys(new Date(2026, 10, 18, 23, 30))).not.toContain('later');
  });

  it('"In a month" from 31 January lands on the last day of February', () => {
    const month = reminderPresets(new Date(2027, 0, 31, 10)).find(p => p.key === 'month')!;
    expect(month.at).toBe(local(2027, 2, 28, 9));
  });
});

describe('snooze and labels', () => {
  it('snoozes to tomorrow at 9, or to 9 today in the small hours', () => {
    expect(snoozeTime(new Date(2026, 10, 20, 14))).toBe(local(2026, 11, 21, 9));
    expect(snoozeTime(new Date(2026, 10, 20, 2))).toBe(local(2026, 11, 20, 9));
  });

  it('formats times relative to today', () => {
    const now = new Date(2026, 10, 20, 10);
    expect(formatReminder(local(2026, 11, 20, 19), now)).toBe('Today, 7:00 PM');
    expect(formatReminder(local(2026, 11, 21, 9), now)).toBe('Tomorrow, 9:00 AM');
    expect(formatReminder(local(2026, 11, 19, 0, 5), now)).toBe('Yesterday, 12:05 AM');
    expect(formatReminder(local(2026, 11, 28, 12), now)).toBe('Sat 28 Nov, 12:00 PM');
    expect(formatReminder(local(2027, 1, 4, 9), now)).toBe('Mon 4 Jan 2027, 9:00 AM');
  });
});
