import { useIsFocused } from '@react-navigation/native';
import { usePreventScreenCapture } from '../security/privacy';

function Active({ id }: { id: string }) {
  usePreventScreenCapture(id);
  return null;
}

/**
 * Blocks screenshots/recording while the current screen is focused, even if
 * the global setting is off. Tabs stay mounted, so focus (not mount) matters.
 */
export function ProtectFromCapture({ id }: { id: string }) {
  const focused = useIsFocused();
  return focused ? <Active id={id} /> : null;
}
