import React, { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVault } from '../store/vault';
import { Item } from '../types';
import { ensureReminderPermission } from '../reminders/notifications';
import { formatReminder, reminderLists, reminderPresets, snoozeTime } from '../reminders/plan';
import { radius, space, useTheme } from '../theme';
import { ChoiceSheet } from './ChoiceSheet';
import { Button, Txt } from './primitives';
import { toast } from './Toast';

/** Sets, moves or clears an item's reminder. One write at a time, even on a double tap. */
export function useSetReminder() {
  const updateItem = useVault(s => s.updateItem);
  const busy = useRef(false);
  return async (item: Item, at: number | null, verb: 'set' | 'done' | 'snooze' | 'clear' = at ? 'set' : 'clear') => {
    if (busy.current) return;
    busy.current = true;
    try {
      const { reminder: _old, ...rest } = item.meta;
      await updateItem(item.id, { meta: at ? { ...rest, reminder: { at } } : rest });
      if (!at) {
        toast(verb === 'done' ? 'Done. Reminder cleared' : 'Reminder removed', 'checkmark-circle');
        return;
      }
      const when = formatReminder(at, new Date());
      const allowed = await ensureReminderPermission();
      toast(
        allowed
          ? `${verb === 'snooze' ? 'Snoozed' : 'Reminder set'}: ${when}`
          : `Saved for ${when}. Notifications are off, so it will show under Due in Forward.`,
        allowed ? 'alarm-outline' : 'notifications-off-outline',
      );
    } catch {
      toast('Could not save the reminder. Try again.', 'alert-circle-outline');
    } finally {
      busy.current = false;
    }
  };
}

/** Quick times for "Remind me". */
export function ReminderSheet({ item, visible, onClose }: { item: Item; visible: boolean; onClose: () => void }) {
  const setReminder = useSetReminder();
  const now = new Date();
  const presets = reminderPresets(now);
  const current = item.meta.reminder?.at;
  const choices = [
    ...presets.map(p => ({ value: p.key, label: p.label, subtitle: formatReminder(p.at, now) })),
    ...(current ? [{ value: 'clear', label: 'Remove reminder', subtitle: `Set for ${formatReminder(current, now)}` }] : []),
  ];
  return (
    <ChoiceSheet
      visible={visible}
      title="Remind me"
      choices={choices}
      value={presets.find(p => p.at === current)?.key ?? ''}
      onClose={onClose}
      onChoose={key => {
        onClose();
        const preset = presets.find(p => p.key === key);
        void setReminder(item, preset ? preset.at : null);
      }}
    />
  );
}

/** Shown on an item with a reminder: when it is, and Done / Snooze once it is due. */
export function ReminderCard({ item, onChange }: { item: Item; onChange: () => void }) {
  const { c } = useTheme();
  const setReminder = useSetReminder();
  const at = item.meta.reminder?.at;
  if (!at || item.trashedAt) return null;
  const now = new Date();
  const due = at <= now.getTime();
  return (
    <View
      style={[styles.card, { backgroundColor: due ? c.accentSoft : c.surface, borderColor: due ? c.accent : c.border }]}
      accessibilityRole="summary"
    >
      <View style={styles.row}>
        <Ionicons name={due ? 'alarm' : 'alarm-outline'} size={22} color={due ? c.accent : c.textSecondary} />
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{due ? 'Reminder due' : 'Reminder'}</Txt>
          <Txt variant="small" color={c.textSecondary}>
            {formatReminder(at, now)}
          </Txt>
        </View>
      </View>
      <View style={styles.actions}>
        {due ? (
          <>
            <Button title="Done" icon="checkmark" compact onPress={() => void setReminder(item, null, 'done')} style={{ flex: 1 }} />
            <Button
              title="Tomorrow"
              icon="time-outline"
              compact
              variant="secondary"
              onPress={() => void setReminder(item, snoozeTime(new Date()), 'snooze')}
              style={{ flex: 1 }}
            />
          </>
        ) : (
          <>
            <Button title="Change" icon="create-outline" compact variant="secondary" onPress={onChange} style={{ flex: 1 }} />
            <Button title="Remove" icon="close" compact variant="ghost" onPress={() => void setReminder(item, null)} style={{ flex: 1 }} />
          </>
        )}
      </View>
    </View>
  );
}



/**
 * Home: reminders that are due (they stay here until marked done, even if the notification was
 * missed or notifications are off) and the next few coming up. Wallet items count too.
 */
export function RemindersSection({ onOpen }: { onOpen: (itemId: string) => void }) {
  const { c } = useTheme();
  const items = useVault(s => s.items);
  // Re-check every minute so a reminder moves to "Due" while the screen is open.
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const { due, upcoming } = React.useMemo(() => reminderLists(items, now), [items, now]);
  if (!due.length && !upcoming.length) return null;
  const today = new Date(now);
  const rows = [...due.map(item => ({ item, due: true })), ...upcoming.slice(0, 3).map(item => ({ item, due: false }))];
  return (
    <View style={{ paddingHorizontal: space.lg, marginTop: space.xl }}>
      <View style={styles.head}>
        <Txt variant="h3">Reminders</Txt>
        {due.length ? (
          <View style={[styles.badge, { backgroundColor: c.accent }]}>
            <Txt variant="caption" color={c.onAccent}>
              {due.length} due
            </Txt>
          </View>
        ) : null}
      </View>
      <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
        {rows.map(({ item, due: isDue }, i) => (
          <Pressable
            key={item.id}
            onPress={() => onOpen(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`${isDue ? 'Due' : 'Coming up'}: ${item.title || 'Untitled'}, ${formatReminder(item.meta.reminder!.at, today)}`}
            style={({ pressed }) => [
              styles.reminderRow,
              i < rows.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
              pressed && { backgroundColor: c.surfaceAlt },
            ]}
          >
            <Ionicons name={isDue ? 'alarm' : 'alarm-outline'} size={20} color={isDue ? c.accent : c.textMuted} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong" numberOfLines={1}>
                {item.title || 'Untitled'}
              </Txt>
              <Txt variant="small" color={isDue ? c.accent : c.textSecondary}>
                {isDue ? 'Due · ' : ''}
                {formatReminder(item.meta.reminder!.at, today)}
              </Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </Pressable>
        ))}
      </View>
      {upcoming.length > 3 ? (
        <Txt variant="small" color={c.textMuted} style={{ marginTop: space.sm }}>
          +{upcoming.length - 3} more coming up
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.md, marginBottom: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  actions: { flexDirection: 'row', gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  badge: { borderRadius: 999, paddingHorizontal: space.sm, paddingVertical: 2 },
  list: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.md },
});
