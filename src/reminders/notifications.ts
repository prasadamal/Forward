import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Item } from '../types';
import { planReminderSync, REMINDER_PREFIX, reminderId, Scheduled } from './plan';

const CHANNEL = 'reminders';
let configured = false;

/** Shows reminders while the app is open too, and creates the Android channel the prompt needs. */
export async function configureReminders(): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Reminders',
      description: 'Reminders you set on saved items',
      importance: Notifications.AndroidImportance.DEFAULT,
      // The text is generic, but nothing from the vault ever shows on the lock screen.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
}

/** Asks once, when someone first sets a reminder. Reminders still show under "Due" in the app without it. */
export async function ensureReminderPermission(): Promise<boolean> {
  try {
    await configureReminders();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

async function scheduledReminders(): Promise<Scheduled[]> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all
    .filter(n => n.identifier.startsWith(REMINDER_PREFIX))
    .map(n => ({
      identifier: n.identifier,
      itemId: String(n.content.data?.itemId ?? ''),
      at: Number(n.content.data?.at ?? 0),
    }));
}

let running: Promise<void> = Promise.resolve();
let latest: Item[] | null = null;

/**
 * Makes the phone's scheduled reminders match the vault. Calls queue up; only the newest item list
 * is applied, so a burst of edits does one pass. Never throws: a failure leaves the in-app "Due"
 * list working and the next change tries again.
 */
export function syncReminders(items: Item[]): Promise<void> {
  latest = items;
  running = running.then(async () => {
    const current = latest;
    if (!current) return;
    latest = null;
    try {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return;
      await configureReminders();
      const plan = planReminderSync(current, await scheduledReminders(), Date.now());
      for (const identifier of plan.cancel) await Notifications.cancelScheduledNotificationAsync(identifier);
      for (const r of plan.schedule) {
        await Notifications.scheduleNotificationAsync({
          identifier: reminderId(r.itemId),
          content: {
            title: 'Forward',
            // Deliberately vague: the lock screen and notification history are not private.
            body: 'You asked to be reminded about something you saved.',
            data: { kind: 'reminder', itemId: r.itemId, at: r.at },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
        });
      }
    } catch {
      // Best effort; see above.
    }
  });
  return running;
}

/** After erasing the vault, nothing it scheduled may fire. */
export async function cancelAllReminders(): Promise<void> {
  try {
    for (const r of await scheduledReminders()) await Notifications.cancelScheduledNotificationAsync(r.identifier);
  } catch {
    // Nothing scheduled, or notifications unavailable.
  }
}

/** The item a tapped reminder points at, if the tap was on one of ours. */
export function reminderItemId(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data;
  return data?.kind === 'reminder' && typeof data.itemId === 'string' ? data.itemId : null;
}
