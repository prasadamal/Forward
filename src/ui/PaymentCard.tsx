import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CardMeta } from '../types';
import { BRAND_LABEL, CARD_THEMES, checkExpiry, formatCardNumber, maskedNumber } from '../wallet/cards';
import { radius, space } from '../theme';
import { Txt } from './primitives';

/**
 * A card face. Shows the full number only when `number` is passed (i.e. after
 * the user has revealed it); otherwise only the last four digits.
 */
export function PaymentCard({
  meta,
  title,
  number,
  onPress,
  compact,
}: {
  meta: CardMeta;
  title: string;
  number?: string;
  onPress?: () => void;
  compact?: boolean;
}) {
  const [base, accent] = CARD_THEMES[meta.theme % CARD_THEMES.length];
  const expiry = meta.expiry ? checkExpiry(meta.expiry) : null;
  const face = (
    <View style={[styles.card, compact && styles.compact, { backgroundColor: base }]}>
      <View style={[styles.blob, { backgroundColor: accent, top: -60, right: -40 }]} />
      <View style={[styles.blob, { backgroundColor: accent, bottom: -90, left: -30, opacity: 0.35 }]} />
      <View style={styles.top}>
        <Txt variant="bodyStrong" color="#FFFFFF" numberOfLines={1} style={{ flex: 1 }}>
          {meta.issuer || title}
        </Txt>
        <Txt variant="caption" color="rgba(255,255,255,0.85)">
          {meta.kind === 'other' ? '' : meta.kind.toUpperCase()}
        </Txt>
      </View>
      <View style={styles.chip} />
      <Txt
        variant={compact ? 'h3' : 'h2'}
        color="#FFFFFF"
        style={styles.number}
        selectable={!!number}
        numberOfLines={1}
      >
        {number ? formatCardNumber(number, meta.brand) : maskedNumber(meta.last4)}
      </Txt>
      <View style={styles.bottom}>
        <View style={{ flex: 1 }}>
          <Txt variant="label" color="rgba(255,255,255,0.65)">
            Card holder
          </Txt>
          <Txt variant="caption" color="#FFFFFF" numberOfLines={1}>
            {meta.holder || '—'}
          </Txt>
        </View>
        <View style={{ marginRight: space.lg }}>
          <Txt variant="label" color="rgba(255,255,255,0.65)">
            Expires
          </Txt>
          <Txt variant="caption" color={expiry?.expired ? '#FFB4B4' : '#FFFFFF'}>
            {meta.expiry || '—'}
            {expiry?.expired ? ' · expired' : ''}
          </Txt>
        </View>
        {meta.brand !== 'other' ? (
          <Txt variant="h3" color="#FFFFFF" style={{ fontStyle: 'italic' }}>
            {BRAND_LABEL[meta.brand]}
          </Txt>
        ) : null}
      </View>
    </View>
  );
  if (!onPress) return face;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${BRAND_LABEL[meta.brand]} ending ${meta.last4}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 1.586,
    borderRadius: radius.xl,
    padding: space.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  compact: { padding: space.lg },
  blob: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.55 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: { width: 40, height: 30, borderRadius: 6, backgroundColor: 'rgba(255,215,140,0.85)' },
  number: { letterSpacing: 2, fontVariant: ['tabular-nums'] },
  bottom: { flexDirection: 'row', alignItems: 'flex-end' },
});
