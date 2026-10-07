import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isWalletType, Item } from '../types';
import { SOURCE_INFO, TYPE_INFO } from '../constants/palette';
import { radius, space, useTheme } from '../theme';
import { useImageUri } from '../store/thumbs';
import { formatRelativeDate } from '../utils/dateUtils';
import { displayHost } from '../ingest/urls';
import { IconName, Txt } from './primitives';
import { BRAND_LABEL } from '../wallet/cards';

export function SourceBadge({ item, compact }: { item: Item; compact?: boolean }) {
  if (item.source === 'manual') return null;
  const info = SOURCE_INFO[item.source] ?? SOURCE_INFO.web;
  return (
    <View style={[styles.badge, { backgroundColor: info.color + '22' }]}>
      <Text style={[styles.badgeText, { color: info.color }]} numberOfLines={1}>
        {compact ? info.label : item.source === 'web' && item.url ? displayHost(item.url) : info.label}
      </Text>
    </View>
  );
}

export function TypeIcon({ item, size = 52 }: { item: Item; size?: number }) {
  const { c } = useTheme();
  const info = TYPE_INFO[item.type];
  const color = item.type === 'link' ? SOURCE_INFO[item.source]?.color ?? c.accent : c.accent;
  return (
    <View style={[styles.thumb, { width: size, height: size, backgroundColor: color + '1F' }]}>
      <Ionicons
        name={(item.sensitive && !isWalletType(item.type) ? 'lock-closed' : info.icon) as IconName}
        size={size * 0.42}
        color={color}
      />
    </View>
  );
}

/** Thumbnail if the item has one (decrypted in memory), otherwise a type icon. */
export function Thumb({ item, size = 52 }: { item: Item; size?: number }) {
  const showImage = item.hasThumb && !item.sensitive;
  const uri = useImageUri(item.id, 'thumb', showImage);
  if (!showImage || !uri) return <TypeIcon item={item} size={size} />;
  return (
    <View>
      <Image source={{ uri }} style={[styles.thumb, { width: size, height: size }]} accessibilityIgnoresInvertColors />
      {item.type === 'video' ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={12} color="#FFF" />
        </View>
      ) : null}
    </View>
  );
}

function subtitleFor(item: Item): string {
  if (item.sensitive && item.type !== 'card' && item.type !== 'login') return 'Hidden';
  switch (item.type) {
    case 'card': {
      const card = item.meta.card;
      return card ? `${BRAND_LABEL[card.brand]} •••• ${card.last4}` : 'Card';
    }
    case 'login':
      return item.meta.login?.username || displayHost(item.meta.login?.website) || 'Login';
    case 'link':
      return item.meta.link?.author || item.text || displayHost(item.url);
    case 'image':
    case 'video':
    case 'file':
      return item.text || item.meta.media?.fileName || TYPE_INFO[item.type].label;
    default:
      return item.text;
  }
}

function ItemRowBase({
  item,
  folderLabel,
  onPress,
  onLongPress,
  selected,
}: {
  item: Item;
  folderLabel?: string;
  onPress: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}) {
  const { c } = useTheme();
  const sub = subtitleFor(item);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityRole="button"
      accessibilityLabel={`${TYPE_INFO[item.type].label}: ${item.title}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: selected ? c.accentSoft : c.surface, borderColor: selected ? c.accent : c.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Thumb item={item} />
      <View style={{ flex: 1, gap: 3 }}>
        <Txt variant="bodyStrong" numberOfLines={2}>
          {item.title || 'Untitled'}
        </Txt>
        {sub ? (
          <Txt variant="small" color={c.textSecondary} numberOfLines={1}>
            {sub}
          </Txt>
        ) : null}
        <View style={styles.metaRow}>
          <SourceBadge item={item} />
          {folderLabel ? (
            <Txt variant="small" color={c.textMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
              {folderLabel}
            </Txt>
          ) : null}
          <View style={{ flex: 1 }} />
          {item.pinned ? <Ionicons name="pin" size={12} color={c.warning} /> : null}
          <Txt variant="small" color={c.textMuted} numberOfLines={1} style={{ flexShrink: 0 }}>
            {formatRelativeDate(item.createdAt)}
          </Txt>
        </View>
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={c.accent} /> : null}
    </Pressable>
  );
}

export const ItemRow = memo(ItemRowBase);

function ImageTileBase({ item, size, onPress }: { item: Item; size: number; onPress: () => void }) {
  const { c } = useTheme();
  const uri = useImageUri(item.id, 'thumb', item.hasThumb && !item.sensitive);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={item.title}
      style={({ pressed }) => [{ width: size, height: size, opacity: pressed ? 0.85 : 1 }]}
    >
      {uri ? (
        <Image source={{ uri }} style={[styles.tile, { width: size, height: size }]} />
      ) : (
        <View style={[styles.tile, { width: size, height: size, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name={(item.sensitive ? 'lock-closed' : TYPE_INFO[item.type].icon) as IconName} size={26} color={c.textMuted} />
        </View>
      )}
      {item.type === 'video' ? (
        <View style={styles.playBadge}>
          <Ionicons name="play" size={12} color="#FFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

export const ImageTile = memo(ImageTileBase);

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, maxWidth: 140 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  thumb: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: space.sm,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  tile: { borderRadius: radius.sm },
  playBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
