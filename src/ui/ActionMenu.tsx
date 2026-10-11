import React, { ReactNode, useCallback, useState } from 'react';
import { ActionSheetIOS, Platform, View } from 'react-native';
import { space } from '../theme';
import { ListRow, Section } from './primitives';
import { Sheet } from './Sheet';

export interface MenuAction {
  label: string;
  destructive?: boolean;
  run: () => void | Promise<void>;
}

/**
 * A "More" menu: the native action sheet on iOS, a bottom sheet on Android.
 * (Android's Alert keeps only three buttons, which silently dropped Delete.)
 * Render `menu` once in the screen and call `open` from a button.
 */
export function useActionMenu(): { menu: ReactNode; open: (title: string, actions: MenuAction[]) => void } {
  const [state, setState] = useState<{ title: string; actions: MenuAction[] } | null>(null);

  const open = useCallback((title: string, actions: MenuAction[]) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: [...actions.map(a => a.label), 'Cancel'],
          cancelButtonIndex: actions.length,
          destructiveButtonIndex: actions.findIndex(a => a.destructive),
        },
        i => void actions[i]?.run(),
      );
    } else {
      setState({ title, actions });
    }
  }, []);

  const close = () => setState(null);
  const menu = (
    <Sheet visible={!!state} onClose={close} title={state?.title}>
      <View style={{ paddingHorizontal: space.lg }}>
        <Section>
          {(state?.actions ?? []).map((a, i, all) => (
            <ListRow
              key={a.label}
              title={a.label}
              destructive={a.destructive}
              last={i === all.length - 1}
              onPress={() => {
                close();
                void a.run();
              }}
            />
          ))}
        </Section>
      </View>
    </Sheet>
  );
  return { menu, open };
}
