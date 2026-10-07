import React, { useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVault } from '../store/vault';
import { useFolderTree, useItem } from '../store/selectors';
import { useImageUri } from '../store/thumbs';
import { isWalletType, Item, ItemSecret } from '../types';
import { pathLabel } from '../folders/tree';
import { SOURCE_INFO, TYPE_INFO } from '../constants/palette';
import { formatFullDate } from '../utils/dateUtils';
import { formatBytes } from '../utils/encoding';
import { displayHost } from '../ingest/urls';
import { copySecret, copyText } from '../security/clipboard';
import { ProtectFromCapture } from '../ui/ProtectFromCapture';
import { shareItemOut } from '../actions/files';
import { radius, space, useTheme } from '../theme';
import { Button, Chip, EmptyState, Header, IconButton, IconName, Screen, Scroll, Txt } from '../ui/primitives';
import { SourceBadge, TypeIcon } from '../ui/items';
import { FolderPickerSheet } from '../ui/folders';
import { PaymentCard } from '../ui/PaymentCard';
import { SecretField } from '../ui/SecretField';
import { useReveal } from '../ui/useReveal';
import { toast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Item'>;


function openUrl(url: string) {
  Linking.openURL(url).catch(() => Alert.alert('Can’t open link', 'No app on this phone can open it.'));
}

function Hero({ item, onPress }: { item: Item; onPress?: () => void }) {
  const { c } = useTheme();
  const kind = item.type === 'image' ? 'original' : 'thumb';
  const uri = useImageUri(item.id, kind, (item.type === 'image' ? item.hasBlob : item.hasThumb) && !item.sensitive);
  if (!uri) return null;
  const media = item.meta.media;
  const ratio = media?.width && media?.height ? media.width / media.height : 16 / 9;
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'imagebutton' : 'image'} accessibilityLabel={item.title}>
      <Image
        source={{ uri }}
        resizeMode="cover"
        style={[styles.hero, { aspectRatio: Math.max(0.6, Math.min(ratio, 2)), backgroundColor: c.surfaceAlt }]}
      />
      {item.type === 'video' ? (
        <View style={styles.play}>
          <Ionicons name="play" size={30} color="#FFF" />
        </View>
      ) : null}
    </Pressable>
  );
}

function InfoRow({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.infoRow} accessibilityRole={onPress ? 'button' : undefined}>
      <Ionicons name={icon} size={18} color={c.textMuted} />
      <View style={{ flex: 1 }}>
        <Txt variant="small" color={c.textMuted}>
          {label}
        </Txt>
        <Txt variant="body" color={onPress ? c.accent : c.text} numberOfLines={2}>
          {value}
        </Txt>
      </View>
      {onPress ? <Ionicons name="open-outline" size={16} color={c.accent} /> : null}
    </Pressable>
  );
}

export default function ItemScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const { itemId } = useRoute<Route>().params;
  const item = useItem(itemId);
  const tree = useFolderTree();
  const settings = useVault(s => s.settings);
  const getSecret = useVault(s => s.getSecret);
  const togglePin = useVault(s => s.togglePin);
  const trashItems = useVault(s => s.trashItems);
  const restoreItems = useVault(s => s.restoreItems);
  const setItemFolders = useVault(s => s.setItemFolders);
  const refileItem = useVault(s => s.refileItem);
  const createFolder = useVault(s => s.createFolder);
  const { ensure, prompt } = useReveal('Show secret details');
  const [secret, setSecret] = useState<ItemSecret | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [picking, setPicking] = useState(false);

  // Forget decrypted secrets when leaving or when the item changes.
  useEffect(() => () => setSecret(null), [itemId]);

  if (!item) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
        <EmptyState emoji="🫥" title="This item is gone" body="It may have been deleted." />
      </Screen>
    );
  }

  const wallet = isWalletType(item.type);
  const protectedItem = wallet || item.sensitive;

  const reveal = async () => {
    if (revealed) {
      setRevealed(false);
      return;
    }
    if (!(await ensure())) return;
    setSecret(await getSecret(item.id));
    setRevealed(true);
  };

  const copy = async (value: string, label: string, isSecret = true) => {
    if (isSecret) {
      if (!(await ensure())) return;
      await copySecret(value, settings.clipboardClearSeconds);
      toast(
        settings.clipboardClearSeconds
          ? `${label} copied · clears in ${settings.clipboardClearSeconds}s`
          : `${label} copied`,
        'copy',
      );
    } else {
      await copyText(value);
      toast(`${label} copied`, 'copy');
    }
  };

  const edit = async () => {
    // Editing shows secret values, so it needs the same check as revealing.
    if (protectedItem && !(await ensure())) return;
    nav.navigate('EditItem', { itemId: item.id });
  };

  const remove = () =>
    Alert.alert('Move to Trash?', 'You can restore it from Trash for 30 days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move to Trash',
        style: 'destructive',
        onPress: async () => {
          await trashItems([item.id]);
          toast('Moved to Trash', 'trash');
          nav.goBack();
        },
      },
    ]);

  const more = () => {
    const actions: { label: string; destructive?: boolean; run: () => void }[] = [
      { label: 'Edit', run: () => void edit() },
      { label: 'Move to folders…', run: () => setPicking(true) },
    ];
    if (!wallet) {
      actions.push({
        label: 'Sort automatically',
        run: async () => {
          await refileItem(item.id);
          toast('Sorted again');
        },
      });
    }
    actions.push({ label: 'Move to Trash', destructive: true, run: remove });
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...actions.map(a => a.label), 'Cancel'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: actions.findIndex(a => a.destructive),
        },
        i => actions[i]?.run(),
      );
    } else {
      Alert.alert(item.title || 'Item', undefined, [
        ...actions.map(a => ({ text: a.label, style: a.destructive ? ('destructive' as const) : ('default' as const), onPress: a.run })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  const link = item.meta.link;
  const media = item.meta.media;
  const card = item.meta.card;
  const login = item.meta.login;
  const showContent = !item.sensitive || revealed;

  return (
    <Screen>
      {protectedItem ? <ProtectFromCapture id="item-secret" /> : null}
      <Header
        onBack={() => nav.goBack()}
        right={
          item.trashedAt ? (
            <Button
              title="Restore"
              compact
              variant="secondary"
              onPress={async () => {
                await restoreItems([item.id]);
                toast('Restored');
              }}
            />
          ) : (
            <>
              <IconButton
                name={item.pinned ? 'pin' : 'pin-outline'}
                label={item.pinned ? 'Unpin' : 'Pin'}
                color={item.pinned ? c.warning : undefined}
                onPress={() => void togglePin(item.id)}
              />
              {!wallet ? <IconButton name="share-outline" label="Share" onPress={() => void shareItemOut(item)} /> : null}
              <IconButton name="ellipsis-horizontal" label="More actions" onPress={more} />
            </>
          )
        }
      />
      <Scroll>
        {/* ── Wallet: card ── */}
        {item.type === 'card' && card ? (
          <View style={{ marginBottom: space.lg }}>
            <PaymentCard meta={card} title={item.title} number={revealed ? secret?.card?.number : undefined} onPress={reveal} />
            <Button
              title={revealed ? 'Hide details' : 'Show card details'}
              icon={revealed ? 'eye-off-outline' : 'eye-outline'}
              variant="secondary"
              onPress={reveal}
              style={{ marginTop: space.md }}
            />
          </View>
        ) : null}

        {item.type !== 'card' ? (
          <View style={styles.titleRow}>
            {!item.hasThumb || item.sensitive ? <TypeIcon item={item} size={48} /> : null}
            <View style={{ flex: 1 }}>
              <Txt variant="title" selectable>
                {item.title || 'Untitled'}
              </Txt>
              <View style={styles.badges}>
                <SourceBadge item={item} />
                <Txt variant="small" color={c.textMuted}>
                  {TYPE_INFO[item.type].label}
                  {link?.author ? ` · ${link.author}` : ''}
                </Txt>
              </View>
            </View>
          </View>
        ) : null}

        {showContent && (item.type === 'link' || item.type === 'image' || item.type === 'video') ? (
          <Hero
            item={item}
            onPress={
              item.type === 'image'
                ? () => nav.navigate('ImageViewer', { itemId: item.id })
                : item.type === 'video'
                  ? () => nav.navigate('VideoPlayer', { itemId: item.id })
                  : item.url
                    ? () => openUrl(item.url!)
                    : undefined
            }
          />
        ) : null}

        {item.type === 'video' && !item.hasThumb && showContent ? (
          <Button title="Play video" icon="play" onPress={() => nav.navigate('VideoPlayer', { itemId: item.id })} style={{ marginBottom: space.lg }} />
        ) : null}

        {item.sensitive && !wallet && !revealed ? (
          <Pressable onPress={reveal} style={[styles.hidden, { backgroundColor: c.surfaceAlt }]} accessibilityRole="button">
            <Ionicons name="eye-off-outline" size={26} color={c.textMuted} />
            <Txt variant="bodyStrong" color={c.textSecondary}>
              Hidden — tap to show
            </Txt>
          </Pressable>
        ) : null}

        {/* ── Links ── */}
        {item.type === 'link' && item.url ? (
          <>
            <Button title={`Open in ${SOURCE_INFO[item.source]?.label ?? 'browser'}`} icon="open-outline" onPress={() => openUrl(item.url!)} />
            <InfoRow icon="link-outline" label="Link" value={displayHost(item.url)} onPress={() => void copy(item.url!, 'Link', false)} />
            {link?.description && showContent ? (
              <Txt variant="body" color={c.textSecondary} selectable style={{ marginTop: space.md }}>
                {link.description}
              </Txt>
            ) : null}
          </>
        ) : null}

        {/* ── Files ── */}
        {item.type === 'file' && showContent ? (
          <View style={[styles.fileBox, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="document-outline" size={28} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong" numberOfLines={2}>
                {media?.fileName ?? item.title}
              </Txt>
              <Txt variant="small" color={c.textMuted}>
                {[media?.mime, media?.size ? formatBytes(media.size) : null].filter(Boolean).join(' · ')}
              </Txt>
            </View>
            <Button title="Open" compact onPress={() => void shareItemOut(item)} />
          </View>
        ) : null}

        {/* ── Wallet: login ── */}
        {item.type === 'login' && login ? (
          <View style={{ marginTop: space.sm }}>
            {login.website ? (
              <InfoRow
                icon="globe-outline"
                label="Website"
                value={displayHost(login.website) || login.website}
                onPress={() => openUrl(/^https?:\/\//.test(login.website) ? login.website : `https://${login.website}`)}
              />
            ) : null}
            <SecretField label="Username" value={login.username} revealed onCopy={() => void copy(login.username, 'Username', false)} />
            <SecretField
              label="Password"
              value={revealed ? secret?.login?.password ?? '' : '••••••••'}
              revealed={revealed}
              onReveal={reveal}
              onCopy={async () => {
                const s = revealed ? secret : (await ensure()) ? await getSecret(item.id) : null;
                if (s?.login?.password) await copy(s.login.password, 'Password');
              }}
            />
          </View>
        ) : null}

        {/* ── Wallet: card details ── */}
        {item.type === 'card' && card && revealed && secret?.card ? (
          <View>
            <SecretField label="Card number" value={secret.card.number} revealed mono onCopy={() => void copy(secret.card!.number, 'Card number')} />
            <SecretField label="CVV" value={secret.card.cvv} revealed mono onCopy={() => void copy(secret.card!.cvv, 'CVV')} />
            <SecretField label="PIN" value={secret.card.pin} revealed mono onCopy={() => void copy(secret.card!.pin, 'PIN')} />
          </View>
        ) : null}

        {/* ── Wallet: secure note ── */}
        {item.type === 'secret' ? (
          revealed ? (
            <View style={[styles.noteBox, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Txt variant="body" selectable>
                {secret?.note || '—'}
              </Txt>
              {secret?.note ? (
                <Button title="Copy" icon="copy-outline" variant="ghost" compact onPress={() => void copy(secret.note!, 'Note')} style={{ alignSelf: 'flex-start', marginTop: space.sm }} />
              ) : null}
            </View>
          ) : (
            <Pressable onPress={reveal} style={[styles.hidden, { backgroundColor: c.surfaceAlt }]} accessibilityRole="button">
              <Ionicons name="lock-closed-outline" size={26} color={c.textMuted} />
              <Txt variant="bodyStrong" color={c.textSecondary}>
                Tap to show
              </Txt>
            </Pressable>
          )
        ) : null}

        {/* ── Note / caption ── */}
        {item.text && showContent ? (
          <View style={{ marginTop: space.lg }}>
            <Txt variant="label" color={c.textMuted} style={{ marginBottom: space.xs }}>
              {item.type === 'note' ? 'Note' : wallet ? 'Notes' : 'Your note'}
            </Txt>
            <Txt variant="body" selectable>
              {item.text}
            </Txt>
          </View>
        ) : null}

        {/* ── Folders & tags ── */}
        <View style={{ marginTop: space.xl }}>
          <View style={styles.sectionHead}>
            <Txt variant="label" color={c.textMuted}>
              Folders
            </Txt>
            {!item.trashedAt ? (
              <Pressable onPress={() => setPicking(true)} hitSlop={8} accessibilityRole="button">
                <Txt variant="caption" color={c.accent}>
                  Change
                </Txt>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.chips}>
            {item.folderIds.filter(id => tree.byId.has(id)).length ? (
              item.folderIds
                .filter(id => tree.byId.has(id))
                .map(id => (
                  <Chip
                    key={id}
                    label={pathLabel(tree, id)}
                    icon={tree.byId.get(id)!.emoji}
                    onPress={() => nav.navigate('Folder', { folderId: id })}
                  />
                ))
            ) : (
              <Txt variant="caption" color={c.textSecondary}>
                {wallet ? 'Not in a folder (it’s in your Wallet).' : 'Inbox — not in a folder yet.'}
              </Txt>
            )}
          </View>
          {item.tags.length && showContent ? (
            <View style={[styles.chips, { marginTop: space.md }]}>
              {item.tags.slice(0, 10).map(t => (
                <Text key={t} style={[styles.tag, { color: c.textSecondary, backgroundColor: c.surfaceAlt }]}>
                  #{t}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        {media && item.type !== 'file' ? (
          <Txt variant="small" color={c.textMuted} style={{ marginTop: space.lg }}>
            {[media.width && media.height ? `${media.width}×${media.height}` : null, formatBytes(media.size), media.mime]
              .filter(Boolean)
              .join(' · ')}
          </Txt>
        ) : null}
        <Txt variant="small" color={c.textMuted} style={{ marginTop: space.sm }}>
          Saved {formatFullDate(item.createdAt)}
          {item.filing === 'auto' && !wallet ? ' · sorted automatically' : ''}
        </Txt>
      </Scroll>

      <FolderPickerSheet
        visible={picking}
        tree={tree}
        title="Folders for this item"
        subtitle="An item can be in several folders."
        initialSelected={item.folderIds}
        onCreateFolder={(parentId, name) => createFolder({ parentId, name })}
        onConfirm={async ids => {
          setPicking(false);
          await setItemFolders(item.id, ids);
          toast(ids.length ? 'Folders updated' : 'Moved to Inbox');
        }}
        onClose={() => setPicking(false)}
      />
      {prompt}
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginBottom: space.lg },
  badges: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
  hero: { width: '100%', borderRadius: radius.lg, marginBottom: space.lg },
  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  hidden: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.xxl,
    borderRadius: radius.lg,
    marginBottom: space.lg,
  },
  fileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteBox: { padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, marginTop: space.sm },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, overflow: 'hidden' },
});
