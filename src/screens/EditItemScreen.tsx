import React, { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useVault } from '../store/vault';
import { useFolderTree, useItem } from '../store/selectors';
import { getSession } from '../store/session';
import { CardKind, CardMeta, isWalletType, ItemSecret, ItemType } from '../types';
import { pathLabel } from '../folders/tree';
import { TYPE_INFO } from '../constants/palette';
import { detectSource, extractUrl } from '../ingest/urls';
import { placeholderTitle } from '../ingest/drafts';
import { firstLine } from '../organizer/text';
import {
  BRAND_LABEL,
  CARD_THEMES,
  checkExpiry,
  cvvLength,
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiryInput,
  last4,
  luhnValid,
} from '../wallet/cards';
import { DEFAULT_PASSWORD_OPTIONS, generatePassword, passwordStrength } from '../wallet/passwords';
import { secureRandomBytes } from '../utils/ids';
import { ProtectFromCapture } from '../ui/ProtectFromCapture';
import { radius, space, useTheme } from '../theme';
import { Button, Chip, Header, ListRow, Screen, Scroll, Section, TextField, Txt } from '../ui/primitives';
import { FolderPickerSheet } from '../ui/folders';
import { PaymentCard } from '../ui/PaymentCard';
import { toast } from '../ui/Toast';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'EditItem'>;

const KINDS: { key: CardKind; label: string }[] = [
  { key: 'credit', label: 'Credit' },
  { key: 'debit', label: 'Debit' },
  { key: 'prepaid', label: 'Prepaid' },
  { key: 'other', label: 'Other' },
];


function StrengthBar({ password }: { password: string }) {
  const { c } = useTheme();
  if (!password) return null;
  const s = passwordStrength(password);
  const colors = [c.danger, c.danger, c.warning, c.success, c.success];
  return (
    <View style={{ marginTop: -space.sm, marginBottom: space.lg }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i < Math.max(1, s.score) ? colors[s.score] : c.border }} />
        ))}
      </View>
      <Txt variant="small" color={colors[s.score]} style={{ marginTop: 4 }}>
        {s.label}
      </Txt>
    </View>
  );
}

export default function EditItemScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const params = useRoute<Route>().params ?? {};
  const existing = useItem(params.itemId);
  const tree = useFolderTree();
  const createItem = useVault(s => s.createItem);
  const updateItem = useVault(s => s.updateItem);
  const setSecret = useVault(s => s.setSecret);
  const setItemFolders = useVault(s => s.setItemFolders);
  const getSecret = useVault(s => s.getSecret);
  const createFolder = useVault(s => s.createFolder);
  const enrich = useVault(s => s.enrich);

  const type: ItemType = existing?.type ?? params.type ?? 'note';
  const wallet = isWalletType(type);
  const isEdit = !!existing;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [text, setText] = useState(existing?.text ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [sensitive, setSensitive] = useState(existing?.sensitive ?? false);
  const [folderIds, setFolderIds] = useState<string[]>(existing?.folderIds ?? (params.folderId ? [params.folderId] : []));
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Card
  const card = existing?.meta.card;
  const [number, setNumber] = useState('');
  const [holder, setHolder] = useState(card?.holder ?? '');
  const [expiry, setExpiry] = useState(card?.expiry ?? '');
  const [cvv, setCvv] = useState('');
  const [pin, setPin] = useState('');
  const [issuer, setIssuer] = useState(card?.issuer ?? '');
  const [kind, setKind] = useState<CardKind>(card?.kind ?? 'credit');
  const [theme, setTheme] = useState(card?.theme ?? Math.floor(Math.random() * CARD_THEMES.length));
  // Login
  const login = existing?.meta.login;
  const [website, setWebsite] = useState(login?.website ?? '');
  const [username, setUsername] = useState(login?.username ?? '');
  const [password, setPassword] = useState('');
  // Secure note
  const [secretNote, setSecretNote] = useState('');

  // Load secrets once; later store refreshes must not overwrite what the user is typing.
  const editId = existing?.id;
  useEffect(() => {
    if (!editId || !wallet) return;
    let alive = true;
    getSecret(editId).then(s => {
      if (!s || !alive) return;
      setNumber(s.card?.number ?? '');
      setCvv(s.card?.cvv ?? '');
      setPin(s.card?.pin ?? '');
      setPassword(s.login?.password ?? '');
      setSecretNote(s.note ?? '');
    });
    return () => {
      alive = false;
    };
  }, [editId, wallet, getSecret]);

  const brand = useMemo(() => detectBrand(number), [number]);
  const previewMeta: CardMeta = {
    brand,
    last4: last4(number) || card?.last4 || '',
    holder,
    expiry,
    issuer,
    kind,
    theme,
  };

  const heading = `${isEdit ? 'Edit' : 'New'} ${TYPE_INFO[type].label.toLowerCase()}`;

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (type === 'link') {
      const found = extractUrl(url.trim()) ?? extractUrl(`https://${url.trim()}`);
      if (!url.trim() || !found) e.url = 'Enter a valid link';
    }
    if (type === 'note' && !text.trim() && !title.trim()) e.text = 'Write something';
    if (type === 'card') {
      const d = digitsOnly(number);
      if (d.length < 12 || d.length > 19) e.number = 'Card numbers have 12–19 digits';
      if (expiry && !checkExpiry(expiry).valid) e.expiry = 'Use MM/YY';
      if (cvv && !/^\d{3,4}$/.test(cvv)) e.cvv = '3 or 4 digits';
      if (pin && !/^\d{4,6}$/.test(pin)) e.pin = '4–6 digits';
    }
    if (type === 'login' && !password && !username) e.username = 'Add a username or password';
    if (type === 'secret' && !secretNote.trim()) e.secretNote = 'Write the secret';
    if (type === 'secret' && !title.trim()) e.title = 'Give it a name';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const doSave = async () => {
    setSaving(true);
    try {
      let secret: ItemSecret | undefined;
      let meta = existing?.meta ?? {};
      let finalTitle = title.trim();
      let finalUrl: string | undefined = existing?.url;

      if (type === 'card') {
        secret = { card: { number: digitsOnly(number), cvv, pin } };
        meta = { ...meta, card: { ...previewMeta, last4: last4(number) } };
        finalTitle = finalTitle || [issuer.trim(), BRAND_LABEL[brand], kind !== 'other' ? `${kind} card` : 'card'].filter(Boolean).join(' ');
      } else if (type === 'login') {
        secret = { login: { password } };
        const site = website.trim();
        meta = { ...meta, login: { username: username.trim(), website: site } };
        finalTitle = finalTitle || site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'Login';
      } else if (type === 'secret') {
        secret = { note: secretNote };
      } else if (type === 'link') {
        finalUrl = extractUrl(url.trim()) ?? extractUrl(`https://${url.trim()}`);
        const source = detectSource(finalUrl);
        meta = { ...meta, link: { ...meta.link, autoTitle: !finalTitle } };
        finalTitle = finalTitle || placeholderTitle('link', source);
      } else if (type === 'note') {
        finalTitle = finalTitle || firstLine(text, 60) || 'Note';
      }

      if (isEdit && existing) {
        await updateItem(existing.id, {
          title: finalTitle || existing.title,
          text,
          meta,
          sensitive: wallet ? true : sensitive,
          ...(type === 'link' && finalUrl ? { url: finalUrl, source: detectSource(finalUrl) } : {}),
        });
        if (secret) await setSecret(existing.id, secret);
        const sameFolders =
          folderIds.length === existing.folderIds.length && folderIds.every(f => existing.folderIds.includes(f));
        if (!sameFolders) await setItemFolders(existing.id, folderIds);
        if (type === 'link' && finalUrl && finalUrl !== existing.url) enrich(existing.id);
        toast('Saved');
        nav.goBack();
        return;
      }

      if (type === 'link' && finalUrl) {
        const dup = await getSession().repo.findByUrl(finalUrl);
        if (dup) {
          setSaving(false);
          Alert.alert('Already saved', 'This link is already in your vault.', [
            { text: 'OK', style: 'cancel' },
            { text: 'Open it', onPress: () => nav.replace('Item', { itemId: dup.id }) },
          ]);
          return;
        }
      }

      const item = await createItem(
        {
          type,
          title: finalTitle,
          text,
          url: finalUrl,
          source: finalUrl ? detectSource(finalUrl) : 'manual',
          meta,
          secret,
          sensitive: wallet ? true : sensitive,
          folderIds,
          filing: folderIds.length ? 'manual' : 'auto',
        },
        { autoFile: !wallet && !folderIds.length },
      );
      toast(wallet ? 'Saved to your Wallet' : 'Saved');
      nav.replace('Item', { itemId: item.id });
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  const save = () => {
    if (!validate()) return;
    if (type === 'card' && !luhnValid(number)) {
      Alert.alert('Check the card number', 'It doesn’t look like a valid card number. Save anyway?', [
        { text: 'Fix it', style: 'cancel' },
        { text: 'Save anyway', onPress: () => void doSave() },
      ]);
      return;
    }
    void doSave();
  };

  const folderSummary = folderIds.filter(id => tree.byId.has(id)).map(id => pathLabel(tree, id)).join(', ');

  return (
    <Screen>
      {wallet ? <ProtectFromCapture id="edit-secret" /> : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Header
          onBack={() => nav.goBack()}
          backLabel="Cancel"
          title={heading}
          right={<Button title="Save" compact onPress={save} loading={saving} />}
        />
        <Scroll>
          {type === 'card' ? (
            <>
              <View style={{ marginBottom: space.xl }}>
                <PaymentCard meta={previewMeta} title={title || 'Card'} compact />
              </View>
              <TextField
                label="Card number"
                value={formatCardNumber(number, brand)}
                onChangeText={v => setNumber(digitsOnly(v).slice(0, 19))}
                keyboardType="number-pad"
                autoComplete="off"
                textContentType="none"
                importantForAutofill="no"
                placeholder="1234 5678 9012 3456"
                error={errors.number}
                right={number ? <Txt variant="small" color={c.textMuted}>{BRAND_LABEL[brand]}</Txt> : undefined}
              />
              <TextField label="Name on card" value={holder} onChangeText={setHolder} autoCapitalize="characters" placeholder="As printed" />
              <View style={styles.row}>
                <TextField
                  label="Expiry"
                  value={expiry}
                  onChangeText={v => setExpiry(formatExpiryInput(v))}
                  keyboardType="number-pad"
                  placeholder="MM/YY"
                  error={errors.expiry}
                  style={{ flex: 1 }}
                />
                <TextField
                  label="CVV"
                  value={cvv}
                  onChangeText={v => setCvv(digitsOnly(v).slice(0, cvvLength(brand)))}
                  keyboardType="number-pad"
                  secure
                  placeholder={brand === 'amex' ? '4 digits' : '3 digits'}
                  error={errors.cvv}
                  style={{ flex: 1 }}
                />
              </View>
              <TextField
                label="ATM PIN (optional)"
                value={pin}
                onChangeText={v => setPin(digitsOnly(v).slice(0, 6))}
                keyboardType="number-pad"
                secure
                error={errors.pin}
                hint="Only if you really want it here — it stays encrypted and hidden."
              />
              <TextField label="Bank / issuer" value={issuer} onChangeText={setIssuer} placeholder="e.g. HDFC, SBI, ICICI" />
              <Txt variant="label" color={c.textMuted} style={{ marginBottom: space.sm }}>
                Type
              </Txt>
              <View style={[styles.row, { marginBottom: space.lg, flexWrap: 'wrap' }]}>
                {KINDS.map(k => (
                  <Chip key={k.key} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
                ))}
              </View>
              <Txt variant="label" color={c.textMuted} style={{ marginBottom: space.sm }}>
                Colour
              </Txt>
              <View style={[styles.row, { marginBottom: space.xl, flexWrap: 'wrap' }]}>
                {CARD_THEMES.map(([base, acc], i) => (
                  <Pressable
                    key={base + acc}
                    onPress={() => setTheme(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Colour ${i + 1}`}
                    accessibilityState={{ selected: theme === i }}
                    style={[styles.swatch, { backgroundColor: acc, borderColor: theme === i ? c.text : 'transparent' }]}
                  />
                ))}
              </View>
              <TextField label="Card nickname (optional)" value={title} onChangeText={setTitle} placeholder="e.g. Travel card" />
            </>
          ) : null}

          {type === 'login' ? (
            <>
              <TextField label="Website or app" value={website} onChangeText={setWebsite} autoCapitalize="none" keyboardType="url" placeholder="e.g. netbanking.hdfcbank.com" />
              <TextField label="Username or email" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} error={errors.username} />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secure
                autoCapitalize="none"
                autoCorrect={false}
                right={
                  <Pressable
                    onPress={() => setPassword(generatePassword(DEFAULT_PASSWORD_OPTIONS, secureRandomBytes))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Generate a strong password"
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="dice-outline" size={20} color={c.accent} />
                  </Pressable>
                }
              />
              <StrengthBar password={password} />
              <TextField label="Name (optional)" value={title} onChangeText={setTitle} placeholder="Defaults to the website" />
            </>
          ) : null}

          {type === 'secret' ? (
            <>
              <TextField label="Name" value={title} onChangeText={setTitle} placeholder="e.g. Wi-Fi password, Locker code" error={errors.title} />
              <TextField
                label="Secret"
                value={secretNote}
                onChangeText={setSecretNote}
                multiline
                autoCorrect={false}
                error={errors.secretNote}
                hint="Hidden until you reveal it, and never shown in search or lists."
              />
            </>
          ) : null}

          {type === 'link' ? (
            <TextField
              label="Link"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://"
              autoFocus={!isEdit}
              error={errors.url}
            />
          ) : null}

          {type !== 'card' && type !== 'login' && type !== 'secret' ? (
            <TextField
              label={type === 'link' ? 'Title (optional)' : 'Title'}
              value={title}
              onChangeText={setTitle}
              placeholder={type === 'link' ? 'We’ll fetch it from the link' : 'Optional'}
            />
          ) : null}

          <TextField
            label={type === 'note' ? 'Note' : 'Notes'}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus={type === 'note' && !isEdit}
            error={errors.text}
            placeholder={
              type === 'note'
                ? 'Write anything. Mention a place or topic (“Bangalore”, “recipe”) and it’ll be filed for you.'
                : 'Optional'
            }
          />

          <Section>
            <ListRow
              title="Folders"
              subtitle={folderSummary || (wallet ? 'Wallet only' : 'Sorted automatically')}
              icon="folder-outline"
              chevron
              last={wallet}
              onPress={() => setPicking(true)}
            />
            {!wallet ? (
              <ListRow
                title="Hide content"
                subtitle="Keep it blurred until you reveal it"
                icon="eye-off-outline"
                switchValue={sensitive}
                onSwitch={setSensitive}
                last
              />
            ) : null}
          </Section>
          {wallet ? (
            <View style={[styles.lockNote, { backgroundColor: c.accentSoft }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={c.accent} />
              <Txt variant="small" color={c.textSecondary} style={{ flex: 1 }}>
                Encrypted on this phone only. Never uploaded, never synced, hidden from screenshots.
              </Txt>
            </View>
          ) : null}
        </Scroll>
      </KeyboardAvoidingView>
      <FolderPickerSheet
        visible={picking}
        tree={tree}
        initialSelected={folderIds}
        onCreateFolder={(parentId, name) => createFolder({ parentId, name })}
        onConfirm={ids => {
          setFolderIds(ids);
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  lockNote: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
});
