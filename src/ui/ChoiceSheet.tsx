import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { space, useTheme } from '../theme';
import { ListRow, Section } from './primitives';
import { Sheet } from './Sheet';

export interface Choice<T> {
  value: T;
  label: string;
  subtitle?: string;
}

/** A sheet with a single-choice list (auto-lock delay, theme…). */
export function ChoiceSheet<T extends string | number>({
  visible,
  title,
  choices,
  value,
  onChoose,
  onClose,
}: {
  visible: boolean;
  title: string;
  choices: Choice<T>[];
  value: T;
  onChoose: (v: T) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Section>
          {choices.map((ch, i) => (
            <ListRow
              key={String(ch.value)}
              title={ch.label}
              subtitle={ch.subtitle}
              last={i === choices.length - 1}
              onPress={() => {
                onChoose(ch.value);
                onClose();
              }}
              right={ch.value === value ? <Ionicons name="checkmark" size={20} color={c.accent} /> : undefined}
            />
          ))}
        </Section>
      </View>
    </Sheet>
  );
}
