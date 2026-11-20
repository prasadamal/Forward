import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { navigationRef } from '../navigation/navigationRef';
import { useVault } from '../store/vault';
import { toast } from '../ui/Toast';
import { cancelAllReminders, reminderItemId, syncReminders } from './notifications';

/**
 * Keeps scheduled reminders in step with the vault and opens the item when a reminder is tapped.
 * A tap while locked waits for the unlock: nothing about the item is shown before then.
 */
export function useReminders(ready: boolean, navTick: number): void {
  const status = useVault(s => s.status);
  const items = useVault(s => s.items);
  const [tapped, setTapped] = useState<string | null>(null);

  // Taps: the one that launched the app, and any while it runs.
  useEffect(() => {
    const launch = reminderItemId(Notifications.getLastNotificationResponse());
    if (launch) setTapped(launch);
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const id = reminderItemId(response);
      if (id) setTapped(id);
    });
    return () => sub.remove();
  }, []);

  // Only the unlocked vault knows the truth; while locked the item list is empty on purpose.
  useEffect(() => {
    if (status !== 'unlocked') return;
    const timer = setTimeout(() => void syncReminders(items), 400);
    return () => clearTimeout(timer);
  }, [status, items]);

  // An erased vault must not leave reminders behind.
  useEffect(() => {
    if (status === 'setup') void cancelAllReminders();
  }, [status]);

  useEffect(() => {
    if (!tapped || !ready || !navigationRef.isReady()) return;
    const item = items.find(i => i.id === tapped);
    setTapped(null);
    Notifications.clearLastNotificationResponse();
    if (!item || item.trashedAt) {
      toast('That reminder’s item is no longer in Forward', 'alert-circle-outline');
      return;
    }
    const current = navigationRef.getCurrentRoute();
    if (current?.name === 'Item' && (current.params as { itemId?: string } | undefined)?.itemId === item.id) return;
    navigationRef.navigate('Item', { itemId: item.id });
  }, [tapped, ready, items, navTick]);
}
