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

  // iOS: each share arrives as a new forward://dataUrl=… link. Read each link once;
  // re-reading an old link after the next share was written can crash the module.
  const handledUrls = useRef(new Set<string>());
  useEffect(() => {
    const mod = ShareIntentModule;
    if (!mod || Platform.OS !== 'ios' || !url) return;
    const scheme = getScheme({});
    if (!scheme || !url.includes(`${scheme}://dataUrl=`) || handledUrls.current.has(url)) return;
    handledUrls.current.add(url);
    Promise.resolve(mod.getShareIntent(url)).catch(e => console.warn('[share] read failed', e));
  }, [url]);

  // Android: the native module holds the latest share Intent until asked.
  useEffect(() => {
    const mod = ShareIntentModule;
    if (!mod || Platform.OS !== 'android') return;
    const refresh = () => {
      Promise.resolve(mod.getShareIntent('')).catch(e => console.warn('[share] refresh failed', e));
    };
    refresh();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, []);
}
