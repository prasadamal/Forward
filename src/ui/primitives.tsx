import React, { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type, useTheme } from '../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Variant = keyof typeof type;

export function Txt({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
  selectable,
}: {
  children: ReactNode;
  variant?: Variant;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  selectable?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Text
      style={[type[variant], { color: color ?? c.text }, style]}
      numberOfLines={numberOfLines}
      selectable={selectable}
    >
      {children}
    </Text>
  );
}

export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  style,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  const { c, dark } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: c.bg }, style]}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  onBack,
  backLabel,
  right,
  large,
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  right?: ReactNode;
  large?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={backLabel ?? 'Back'}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={24} color={c.accent} />
            {backLabel ? <Txt variant="bodyStrong" color={c.accent}>{backLabel}</Txt> : null}
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }} />
        {right ? <View style={styles.headerRight}>{right}</View> : null}
      </View>
      {title ? (
        <Txt variant={large ? 'largeTitle' : 'title'} numberOfLines={2} style={{ marginTop: onBack ? 4 : 0 }}>
          {title}
        </Txt>
      ) : null}
      {subtitle ? (
        <Txt variant="caption" color={c.textSecondary} style={{ marginTop: 2 }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  label,
  color,
  size = 22,
  filled,
  disabled,
}: {
  name: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  filled?: boolean;
  disabled?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: filled ? c.accent : c.surfaceAlt, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={name} size={size} color={color ?? (filled ? c.onAccent : c.text)} />
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  compact,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const { c } = useTheme();
  const bg =
    variant === 'primary' ? c.accent : variant === 'danger' ? c.dangerSoft : variant === 'secondary' ? c.surfaceAlt : 'transparent';
  const fg = variant === 'primary' ? c.onAccent : variant === 'danger' ? c.danger : variant === 'ghost' ? c.accent : c.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={compact ? 16 : 19} color={fg} /> : null}
          <Txt variant="bodyStrong" color={fg} style={compact ? { fontSize: 14 } : undefined}>
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  color,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: string;
  color?: string;
  count?: number;
}) {
  const { c } = useTheme();
  const tint = color ?? c.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? tint : c.surface,
          borderColor: selected ? tint : c.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon ? <Text style={{ fontSize: 13 }}>{icon}</Text> : null}
      <Txt variant="caption" color={selected ? '#FFFFFF' : c.textSecondary}>
        {label}
      </Txt>
      {count !== undefined ? (
        <Txt variant="small" color={selected ? 'rgba(255,255,255,0.8)' : c.textMuted}>
          {count}
        </Txt>
      ) : null}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { c } = useTheme();
  const base = [styles.card, { backgroundColor: c.surface, borderColor: c.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Section({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ marginBottom: space.xl }}>
      {title ? (
        <Txt variant="label" color={c.textMuted} style={{ marginBottom: space.sm, marginLeft: space.xs }}>
          {title}
        </Txt>
      ) : null}
      <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
      {footer ? (
        <Txt variant="small" color={c.textMuted} style={{ marginTop: space.sm, marginHorizontal: space.xs, lineHeight: 17 }}>
          {footer}
        </Txt>
      ) : null}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  emoji,
  iconColor,
  value,
  onPress,
  chevron,
  destructive,
  switchValue,
  onSwitch,
  last,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  emoji?: string;
  iconColor?: string;
  value?: string;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  switchValue?: boolean;
  onSwitch?: (v: boolean) => void;
  last?: boolean;
  right?: ReactNode;
}) {
  const { c } = useTheme();
  const content = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      {icon || emoji ? (
        <View style={[styles.rowIcon, { backgroundColor: (iconColor ?? c.accent) + '22' }]}>
          {emoji ? (
            <Text style={{ fontSize: 17 }}>{emoji}</Text>
          ) : (
            <Ionicons name={icon!} size={18} color={destructive ? c.danger : iconColor ?? c.accent} />
          )}
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt variant="body" color={destructive ? c.danger : c.text} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" color={c.textMuted} numberOfLines={2} style={{ marginTop: 2 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt variant="caption" color={c.textSecondary} numberOfLines={1} style={{ maxWidth: '45%' }}>
          {value}
        </Txt>
      ) : null}
      {right}
      {onSwitch ? (
        <Switch
          value={!!switchValue}
          onValueChange={onSwitch}
          trackColor={{ true: c.accent, false: c.borderStrong }}
          thumbColor="#FFFFFF"
          accessibilityLabel={title}
        />
      ) : null}
      {chevron ? <Ionicons name="chevron-forward" size={18} color={c.textMuted} /> : null}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  );
}

export function TextField({
  label,
  secure,
  right,
  error,
  hint,
  style,
  inputStyle,
  ...props
}: TextInputProps & {
  label?: string;
  secure?: boolean;
  right?: ReactNode;
  error?: string | null;
  hint?: string;
  inputStyle?: StyleProp<TextStyle>;
}) {
  const { c } = useTheme();
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[{ marginBottom: space.lg }, style as StyleProp<ViewStyle>]}>
      {label ? (
        <Txt variant="label" color={c.textMuted} style={{ marginBottom: 6 }}>
          {label}
        </Txt>
      ) : null}
      <View
        style={[
          styles.field,
          { backgroundColor: c.surface, borderColor: error ? c.danger : c.border },
          props.multiline && { alignItems: 'flex-start' },
        ]}
      >
        <TextInput
          placeholderTextColor={c.textMuted}
          {...props}
          secureTextEntry={secure ? hidden : props.secureTextEntry}
          style={[
            styles.input,
            { color: c.text },
            props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 },
            inputStyle,
          ]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden(h => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show' : 'Hide'}
            style={{ padding: 4 }}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={c.textMuted} />
          </Pressable>
        ) : null}
        {right}
      </View>
      {error ? (
        <Txt variant="small" color={c.danger} style={{ marginTop: 6 }}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="small" color={c.textMuted} style={{ marginTop: 6 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus,
  onFocus,
  editable = true,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  editable?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: c.surfaceAlt }]}>
      <Ionicons name="search" size={17} color={c.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        autoFocus={autoFocus}
        onFocus={onFocus}
        editable={editable}
        returnKeyType="search"
        autoCorrect={false}
        style={[styles.searchInput, { color: c.text }]}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={c.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
}) {
  const { c } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={{ fontSize: 46, marginBottom: space.md }}>{emoji}</Text>
      <Txt variant="h2" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      {body ? (
        <Txt variant="body" color={c.textSecondary} style={{ textAlign: 'center', marginTop: space.sm }}>
          {body}
        </Txt>
      ) : null}
      {action ? (
        <Button title={action.label} icon={action.icon} onPress={action.onPress} style={{ marginTop: space.xl }} />
      ) : null}
    </View>
  );
}

export function Banner({
  tone = 'accent',
  icon,
  title,
  body,
  onPress,
  onClose,
}: {
  tone?: 'accent' | 'warning' | 'success' | 'danger';
  icon: IconName;
  title: string;
  body?: string;
  onPress?: () => void;
  onClose?: () => void;
}) {
  const { c } = useTheme();
  const fg = tone === 'warning' ? c.warning : tone === 'success' ? c.success : tone === 'danger' ? c.danger : c.accent;
  const bg = tone === 'warning' ? c.warningSoft : tone === 'success' ? c.successSoft : tone === 'danger' ? c.dangerSoft : c.accentSoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.banner, { backgroundColor: bg, opacity: pressed ? 0.85 : 1 }]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <Ionicons name={icon} size={20} color={fg} />
      <View style={{ flex: 1 }}>
        <Txt variant="bodyStrong" color={fg}>
          {title}
        </Txt>
        {body ? (
          <Txt variant="small" color={c.textSecondary} style={{ marginTop: 2 }}>
            {body}
          </Txt>
        ) : null}
      </View>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Dismiss">
          <Ionicons name="close" size={18} color={c.textMuted} />
        </Pressable>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={18} color={fg} />
      ) : null}
    </Pressable>
  );
}

export function Scroll({ children, contentStyle }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      contentContainerStyle={[{ paddingHorizontal: space.lg, paddingBottom: 48 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: 40 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  back: { flexDirection: 'row', alignItems: 'center', marginLeft: -6 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  button: {
    minHeight: 52,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonCompact: { minHeight: 38, borderRadius: radius.md, paddingHorizontal: space.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.lg },
  section: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 13, minHeight: 52 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.md,
    gap: space.sm,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 13 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, paddingVertical: 48 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
  },
});
