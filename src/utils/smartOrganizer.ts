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

export function extractTags(text: string): { tags: string[]; folders: string[] } {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  const folders: string[] = [];

  // Detect locations
  for (const loc of LOCATIONS) {
    if (lower.includes(loc)) {
      const capitalized = loc
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      if (!folders.includes(capitalized)) {
        folders.push(capitalized);
      }
      if (!tags.includes(loc)) {
        tags.push(loc);
      }
    }
  }

  // Detect topics
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
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

export function detectPlatform(url: string): Platform {
  const lower = url.toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  if (lower.includes('reddit.com')) return 'reddit';
  if (lower.startsWith('http')) return 'web';
  return 'manual';
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

export function extractUrl(text: string): string | undefined {
  const matches = text.match(URL_REGEX);
  return matches ? matches[0] : undefined;
}

export function extractTitle(content: string, platform?: Platform): string {
  const url = extractUrl(content);
  const textWithoutUrl = url ? content.replace(url, '').trim() : content;

  if (textWithoutUrl.length > 3) {
    return textWithoutUrl.slice(0, 60).trim();
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
