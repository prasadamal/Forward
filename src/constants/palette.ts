import { ItemType, Source } from '../types';

export const FOLDER_COLORS = [
  '#7C6FE0',
  '#FF6584',
  '#2EBD85',
  '#F5A524',
  '#4DA3FF',
  '#E85D9E',
  '#22B8CF',
  '#8BC34A',
  '#FF7A45',
  '#B07CFF',
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Stable color for a folder name. */
export function folderColor(name: string): string {
  return FOLDER_COLORS[hash(name.trim().toLowerCase()) % FOLDER_COLORS.length];
}

export const SOURCE_INFO: Record<Source, { label: string; color: string }> = {
  youtube: { label: 'YouTube', color: '#FF0033' },
  instagram: { label: 'Instagram', color: '#E1306C' },
  x: { label: 'X', color: '#8B98A5' },
  reddit: { label: 'Reddit', color: '#FF4500' },
  facebook: { label: 'Facebook', color: '#1877F2' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  threads: { label: 'Threads', color: '#9A9AA5' },
  pinterest: { label: 'Pinterest', color: '#E60023' },
  spotify: { label: 'Spotify', color: '#1DB954' },
  maps: { label: 'Maps', color: '#34A853' },
  whatsapp: { label: 'WhatsApp', color: '#25D366' },
  telegram: { label: 'Telegram', color: '#229ED9' },
  web: { label: 'Web', color: '#6E7BF2' },
  shared: { label: 'Shared', color: '#7C6FE0' },
  manual: { label: 'Added', color: '#8E8E9A' },
};

export const TYPE_INFO: Record<ItemType, { label: string; plural: string; icon: string; emoji: string }> = {
  link: { label: 'Link', plural: 'Links', icon: 'link', emoji: '🔗' },
  note: { label: 'Note', plural: 'Notes', icon: 'document-text', emoji: '📝' },
  image: { label: 'Image', plural: 'Images', icon: 'image', emoji: '🖼️' },
  video: { label: 'Video', plural: 'Videos', icon: 'videocam', emoji: '🎬' },
  file: { label: 'File', plural: 'Files', icon: 'document-attach', emoji: '📄' },
  card: { label: 'Card', plural: 'Cards', icon: 'card', emoji: '💳' },
  login: { label: 'Login', plural: 'Logins', icon: 'key', emoji: '🔑' },
  secret: { label: 'Secure note', plural: 'Secure notes', icon: 'lock-closed', emoji: '🔒' },
};

/** Emoji choices offered when the user edits a folder. */
export const FOLDER_EMOJIS = [
  '📁', '🌳', '🌆', '🏖️', '🏔️', '🗺️', '✈️', '🍽️', '☕', '🍕', '🎉', '🎬', '🎵', '📱', '💻',
  '🛍️', '💰', '💳', '📚', '💼', '🏠', '💪', '⚽', '😂', '❤️', '⭐', '🎁', '🧳', '🚗', '🐶',
  '👶', '🎓', '🩺', '🧾', '🔒', '📸', '🎮', '🌱', '🛕', '🍻',
];
