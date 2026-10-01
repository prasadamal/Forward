import { Platform } from '../types';

const LOCATIONS: string[] = [
  'bangalore', 'bengaluru', 'mumbai', 'delhi', 'new delhi', 'chennai', 'hyderabad',
  'pune', 'kolkata', 'calcutta', 'goa', 'jaipur', 'agra', 'kerala', 'kochi',
  'coimbatore', 'ahmedabad', 'surat', 'lucknow', 'kanpur', 'nagpur', 'indore',
  'bhopal', 'visakhapatnam', 'vizag', 'patna', 'vadodara', 'guwahati', 'chandigarh',
  'thiruvananthapuram', 'mysore', 'mangalore', 'hubli', 'dharwad', 'belgaum',
  'paris', 'london', 'new york', 'tokyo', 'dubai', 'singapore', 'bali', 'bangkok',
  'thailand', 'vietnam', 'sydney', 'melbourne', 'toronto', 'berlin', 'amsterdam',
  'rome', 'barcelona', 'madrid', 'istanbul', 'moscow', 'beijing', 'shanghai',
  'hong kong', 'seoul', 'los angeles', 'san francisco', 'chicago', 'miami',
  'las vegas', 'boston', 'seattle', 'austin', 'denver', 'portland',
];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  Food: [
    'food', 'restaurant', 'cafe', 'eat', 'dining', 'cuisine', 'recipe', 'biryani',
    'pizza', 'sushi', 'burger', 'pasta', 'curry', 'bar', 'pub', 'brewery', 'brunch',
    'lunch', 'dinner', 'breakfast', 'street food', 'foodie', 'chef', 'menu',
    'taste', 'delicious', 'yummy', 'dish', 'drink', 'beverage', 'cocktail', 'coffee',
    'bakery', 'sweet', 'dessert', 'ice cream', 'snack', 'tiffin', 'dosa', 'idli',
    'pav bhaji', 'vada pav', 'chaat', 'kebab', 'naan', 'paratha', 'thali',
  ],
  Travel: [
    'travel', 'visit', 'trip', 'tour', 'place', 'destination', 'explore',
    'tourism', 'hotel', 'resort', 'beach', 'mountain', 'trek', 'adventure',
    'itinerary', 'flight', 'ticket', 'visa', 'passport', 'backpack', 'hostel',
    'airbnb', 'vacation', 'holiday', 'weekend', 'getaway', 'road trip',
    'temple', 'monument', 'museum', 'waterfall', 'lake', 'river', 'island',
    'fort', 'palace', 'heritage', 'wildlife', 'safari', 'national park',
  ],
  Shopping: [
    'shop', 'buy', 'purchase', 'store', 'market', 'sale', 'discount', 'deal',
    'mall', 'brand', 'fashion', 'clothes', 'shoes', 'accessories', 'jewellery',
    'online', 'amazon', 'flipkart', 'price', 'offer', 'coupon', 'cashback',
    'review', 'unboxing', 'haul', 'wardrobe', 'outfit', 'style',
  ],
  Entertainment: [
    'movie', 'film', 'series', 'show', 'music', 'concert', 'event', 'festival',
    'party', 'club', 'game', 'sport', 'cricket', 'football', 'netflix', 'amazon prime',
    'spotify', 'youtube', 'podcast', 'comedy', 'standup', 'theatre', 'dance',
    'art', 'exhibition', 'performance', 'live', 'stream', 'gaming',
  ],
  Work: [
    'work', 'job', 'career', 'office', 'meeting', 'project', 'deadline', 'task',
    'productivity', 'tool', 'app', 'software', 'startup', 'business', 'entrepreneur',
    'freelance', 'remote', 'interview', 'resume', 'portfolio', 'skills', 'leadership',
    'management', 'team', 'collaboration', 'strategy', 'growth', 'revenue',
  ],
  Health: [
    'health', 'fitness', 'gym', 'yoga', 'meditation', 'diet', 'nutrition',
    'wellness', 'doctor', 'hospital', 'medicine', 'workout', 'exercise', 'run',
    'cycling', 'swimming', 'mental health', 'therapy', 'sleep', 'weight', 'protein',
    'supplement', 'ayurveda', 'holistic', 'detox', 'immunity',
  ],
  Finance: [
    'money', 'finance', 'investment', 'stock', 'crypto', 'bitcoin', 'savings',
    'budget', 'tax', 'bank', 'loan', 'insurance', 'mutual fund', 'sip', 'nifty',
    'sensex', 'trading', 'portfolio', 'dividend', 'interest', 'emi', 'credit',
    'debit', 'wallet', 'upi', 'financial', 'wealth',
  ],
  Learning: [
    'learn', 'course', 'tutorial', 'book', 'read', 'study', 'skill', 'education',
    'class', 'workshop', 'webinar', 'certification', 'degree', 'university',
    'college', 'coaching', 'training', 'lecture', 'knowledge', 'library',
    'github', 'coding', 'programming', 'javascript', 'python', 'react',
  ],
};

const EMOJI_MAP: Record<string, string> = {
  Food: '🍽️',
  Travel: '✈️',
  Shopping: '🛍️',
  Entertainment: '🎬',
  Work: '💼',
  Health: '💪',
  Finance: '💰',
  Learning: '📚',
  Pinned: '📌',
  'All Notes': '📝',
};

const LOCATION_EMOJI_MAP: Record<string, string> = {
  bangalore: '🌆', bengaluru: '🌆', mumbai: '🌊', delhi: '🏛️', 'new delhi': '🏛️',
  chennai: '🌊', goa: '🏖️', kerala: '🌴', jaipur: '🏰',
  paris: '🗼', london: '🎡', 'new york': '🗽', tokyo: '🗾',
  dubai: '🌇', singapore: '🦁', bali: '🌴',
};

// Alternate spellings / names that should land in the same folder.
const LOCATION_ALIASES: Record<string, string> = {
  bengaluru: 'bangalore',
  calcutta: 'kolkata',
  'new delhi': 'delhi',
  vizag: 'visakhapatnam',
};

const termRegexCache = new Map<string, RegExp>();

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whole-word match (with a simple plural / "-ing" tolerance) so that e.g.
 * "chrome" does not match the city "rome", "diagram" does not match "goa" and
 * "Barcelona" does not match the keyword "bar".
 */
function containsTerm(haystack: string, term: string): boolean {
  let re = termRegexCache.get(term);
  if (!re) {
    re = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(term)}(?:s|es|ing)?(?:$|[^a-z0-9])`);
    termRegexCache.set(term, re);
  }
  return re.test(haystack);
}

function capitalizeWords(value: string): string {
  return value
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function extractTags(text: string): { tags: string[]; folders: string[] } {
  const lower = text.toLowerCase().replace(/\s+/g, ' ');
  const tags: string[] = [];
  const folders: string[] = [];

  // Detect locations
  for (const loc of LOCATIONS) {
    if (containsTerm(lower, loc)) {
      const folderName = capitalizeWords(LOCATION_ALIASES[loc] ?? loc);
      if (!folders.includes(folderName)) {
        folders.push(folderName);
      }
      if (!tags.includes(loc)) {
        tags.push(loc);
      }
    }
  }

  // Detect topics
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (containsTerm(lower, kw)) {
        if (!folders.includes(topic)) {
          folders.push(topic);
        }
        if (!tags.includes(kw)) {
          tags.push(kw);
        }
        break;
      }
    }
  }

  return { tags: tags.slice(0, 10), folders };
}

export function assignEmoji(name: string): string {
  const lower = name.toLowerCase();
  if (EMOJI_MAP[name]) return EMOJI_MAP[name];
  if (LOCATION_EMOJI_MAP[lower]) return LOCATION_EMOJI_MAP[lower];

  // Default emojis for topics
  for (const [topic, emoji] of Object.entries(EMOJI_MAP)) {
    if (lower.includes(topic.toLowerCase())) return emoji;
  }

  // Generic city emoji
  return '📍';
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function detectPlatform(url: string): Platform {
  const match = url.trim().match(/^https?:\/\/(?:[^/?#@]*@)?([^/?#:]+)/i);
  if (!match) return 'manual';
  // Compare against the hostname only, so that "dropbox.com" is not mistaken
  // for "x.com" and a "?u=youtube.com" query string is not mistaken for YouTube.
  const host = match[1].toLowerCase();
  if (hostMatches(host, 'youtube.com') || hostMatches(host, 'youtu.be')) return 'youtube';
  if (hostMatches(host, 'instagram.com')) return 'instagram';
  if (hostMatches(host, 'twitter.com') || hostMatches(host, 'x.com')) return 'twitter';
  if (hostMatches(host, 'reddit.com') || hostMatches(host, 'redd.it')) return 'reddit';
  return 'web';
}

// Greedily match a URL then strip any trailing sentence-ending punctuation.
// Using a greedy match ensures dots within the domain and path (e.g. youtu.be)
// are included; we only strip punctuation that appears at the very end.
const URL_REGEX = /https?:\/\/[^\s]+/g;

const CLOSING_TO_OPENING: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

function count(haystack: string, char: string): number {
  return haystack.split(char).length - 1;
}

function stripTrailingPunctuation(url: string): string {
  let result = url;
  while (result.length > 0) {
    const last = result[result.length - 1];
    if (/[.,;:!?'"<>]/.test(last)) {
      result = result.slice(0, -1);
    } else if (last in CLOSING_TO_OPENING) {
      // Keep a closing bracket that balances an opening one inside the URL,
      // e.g. https://en.wikipedia.org/wiki/Foo_(bar)
      if (count(result, last) > count(result, CLOSING_TO_OPENING[last])) {
        result = result.slice(0, -1);
      } else {
        break;
      }
    } else {
      break;
    }
  }
  return result;
}

export function extractUrl(text: string): string | undefined {
  const matches = text.match(URL_REGEX);
  if (!matches) return undefined;
  return stripTrailingPunctuation(matches[0]);
}

export function extractTitle(content: string, platform?: Platform): string {
  const url = extractUrl(content);
  const textWithoutUrl = url ? content.replace(url, '').trim() : content;

  if (textWithoutUrl.length > 3) {
    return textWithoutUrl.replace(/\s+/g, ' ').slice(0, 60).trim();
  }

  if (platform === 'youtube') return 'YouTube Video';
  if (platform === 'instagram') return 'Instagram Post';
  if (platform === 'twitter') return 'Twitter/X Post';
  if (platform === 'reddit') return 'Reddit Post';
  if (url) return url.slice(0, 50);
  return 'Note';
}

export function getFolderColor(name: string): string {
  const colors = [
    '#7C6FE0', '#FF6584', '#4CAF50', '#FF9800', '#2196F3',
    '#E91E63', '#00BCD4', '#8BC34A', '#FF5722', '#9C27B0',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}
