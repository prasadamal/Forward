const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('expo/config-plugins');

/**
 * expo-share-intent derives the iOS share extension's Xcode target name from
 * its display name, so the extension can't simply be called "Forward" (that's
 * the app target). The extension is created as "ForwardShare"; this plugin then
 * sets the name shown in the share sheet back to the app's name.
 *
 * Runs as a finalized mod, after expo-share-intent has written its files.
 */
module.exports = function withShareExtensionDisplayName(config, { targetName, displayName } = {}) {
  const target = targetName || 'ForwardShare';
  const name = displayName || config.name;
  return withFinalizedMod(config, [
    'ios',
    async cfg => {
      const plist = path.join(cfg.modRequest.platformProjectRoot, target, 'ShareExtension-Info.plist');
      if (!fs.existsSync(plist)) {
        throw new Error(`[withShareExtensionDisplayName] ${plist} not found; did expo-share-intent run?`);
      }
      const contents = fs.readFileSync(plist, 'utf8');
      const updated = contents.replace(
        /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]*(<\/string>)/,
        (_, open, close) => `${open}${name}${close}`,
      );
      if (updated === contents && !contents.includes(`<string>${name}</string>`)) {
        throw new Error('[withShareExtensionDisplayName] CFBundleDisplayName not found in share extension Info.plist');
      }
      fs.writeFileSync(plist, updated);
      return cfg;
    },
  ]);
};
