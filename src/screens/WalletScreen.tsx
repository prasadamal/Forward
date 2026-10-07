import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useWalletItems } from '../store/selectors';
import { ProtectFromCapture } from '../ui/ProtectFromCapture';
import { displayHost } from '../ingest/urls';
import { space, useTheme } from '../theme';
import { EmptyState, Header, IconButton, ListRow, Screen, Section, Txt } from '../ui/primitives';
import { PaymentCard } from '../ui/PaymentCard';
import { Sheet } from '../ui/Sheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function WalletScreen() {
  const { c } = useTheme();
  const nav = useNavigation<Nav>();
  const items = useWalletItems();
  const [adding, setAdding] = useState(false);

  const { cards, logins, secrets } = useMemo(() => {
    const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);
    return {
      cards: items.filter(i => i.type === 'card').sort(byTitle),
      logins: items.filter(i => i.type === 'login').sort(byTitle),
      secrets: items.filter(i => i.type === 'secret').sort(byTitle),
    };
  }, [items]);

  const add = (type: 'card' | 'login' | 'secret') => {
    setAdding(false);
    nav.navigate('EditItem', { type });
  };

  return (
    <Screen>
      <ProtectFromCapture id="wallet" />
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Header
          title="Wallet"
          large
          subtitle="Cards, passwords and secrets. Encrypted, never uploaded."
          right={<IconButton name="add" filled label="Add to wallet" onPress={() => setAdding(true)} />}
        />
        <View style={{ paddingHorizontal: space.lg }}>
          {!items.length ? (
            <EmptyState
              emoji="👛"
              title="Your secure wallet"
              body="Keep debit & credit cards, net-banking logins, Wi-Fi passwords and ID numbers here. Card numbers and passwords stay hidden until you confirm it’s you."
              action={{ label: 'Add a card', icon: 'card-outline', onPress: () => add('card') }}
            />
          ) : null}

          {cards.length ? (
            <View style={{ marginBottom: space.xl }}>
              <Txt variant="label" color={c.textMuted} style={styles.label}>
                Cards
              </Txt>
              <View style={{ gap: space.md }}>
                {cards.map(card =>
                  card.meta.card ? (
                    <PaymentCard key={card.id} meta={card.meta.card} title={card.title} compact onPress={() => nav.navigate('Item', { itemId: card.id })} />
                  ) : null,
                )}
              </View>
            </View>
          ) : null}

          {logins.length ? (
            <Section title="Passwords">
              {logins.map((l, i) => (
                <ListRow
                  key={l.id}
                  title={l.title}
                  subtitle={l.meta.login?.username || displayHost(l.meta.login?.website)}
                  icon="key-outline"
                  iconColor="#2EBD85"
                  chevron
                  last={i === logins.length - 1}
                  onPress={() => nav.navigate('Item', { itemId: l.id })}
                />
              ))}
            </Section>
          ) : null}

          {secrets.length ? (
            <Section title="Secure notes">
              {secrets.map((s, i) => (
                <ListRow
                  key={s.id}
                  title={s.title}
                  subtitle="Hidden"
                  icon="lock-closed-outline"
                  iconColor="#FF7A45"
                  chevron
                  last={i === secrets.length - 1}
                  onPress={() => nav.navigate('Item', { itemId: s.id })}
                />
              ))}
            </Section>
          ) : null}
        </View>
      </ScrollView>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add to wallet">
        <View style={{ paddingHorizontal: space.lg }}>
          <Section>
            <ListRow title="Debit or credit card" subtitle="Number, expiry, CVV and PIN" icon="card-outline" chevron onPress={() => add('card')} />
            <ListRow title="Password" subtitle="Net banking, email, apps — with a generator" icon="key-outline" iconColor="#2EBD85" chevron onPress={() => add('login')} />
            <ListRow
              title="Secure note"
              subtitle="Wi-Fi, locker codes, ID numbers…"
              icon="lock-closed-outline"
              iconColor="#FF7A45"
              chevron
              last
              onPress={() => add('secret')}
            />
          </Section>
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: space.sm, marginLeft: space.xs },
});
