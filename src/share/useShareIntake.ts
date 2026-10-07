import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useLinkingURL } from 'expo-linking';
import { getScheme, getShareExtensionKey, ShareIntentModule } from 'expo-share-intent';
import { parseNativeShare, shareSignature } from '../ingest/shareParser';
import { IncomingShare } from '../types';
import { newId } from '../utils/ids';

/**
 * Receives content forwarded from other apps via the system share sheet.
 *
 * iOS: the share extension saves the payload to the App Group and opens
 * forward://dataUrl=…; we ask the native module to read it.
 * Android: the share Intent is held by the native module until we ask for it.
 *
 * Each payload is handed to `onShare` once and then cleared natively, so it
 * isn't delivered again on the next launch.
 */
export function useShareIntake(onShare: (share: IncomingShare) => void): void {
  const url = useLinkingURL();
  const latest = useRef(onShare);
  latest.current = onShare;
  const recent = useRef<{ sig: string; at: number }[]>([]);

  useEffect(() => {
    const mod = ShareIntentModule;
    if (!mod) return;
    const options = {};
    const changeSub = mod.addListener('onChange', event => {
      const share = parseNativeShare(event.value, newId());
      try {
        mod.clearShareIntent(getShareExtensionKey(options));
      } catch {
        // ignore
      }
      if (!share) return;
      // Native code can emit the same payload twice (link + app-active refresh).
      const sig = shareSignature(share);
      const now = Date.now();
      recent.current = recent.current.filter(r => now - r.at < 10_000);
      if (recent.current.some(r => r.sig === sig)) return;
      recent.current.push({ sig, at: now });
      latest.current({ ...share, origin: 'share' });
    });
    const errorSub = mod.addListener('onError', event => {
      console.warn('[share] could not read shared content:', event?.value);
    });
    return () => {
      changeSub.remove();
      errorSub.remove();
    };
  }, []);

  useEffect(() => {
    const mod = ShareIntentModule;
    if (!mod) return;
    const refresh = () => {
      try {
        if (Platform.OS === 'ios') {
          const scheme = getScheme({});
          if (url && scheme && url.includes(`${scheme}://dataUrl=`)) mod.getShareIntent(url);
        } else if (Platform.OS === 'android') {
          mod.getShareIntent('');
        }
      } catch (e) {
        console.warn('[share] refresh failed', e);
      }
    };
    refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [url]);
}
