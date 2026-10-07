/**
 * Topics used to auto-file items, e.g. "Bangalore › Food".
 *
 * - `strong` keywords count fully; `weak` keywords count half (they are common
 *   words that only hint at a topic, like "visit" or "download").
 * - `domains` are sites whose links almost always belong to the topic.
 * - `emoji` hints are matched against the raw text (😂 → Memes).
 */
export interface TopicDef {
  name: string;
  emoji: string;
  strong: string[];
  weak?: string[];
  domains?: string[];
  emojiHints?: string[];
}

export const TOPICS: TopicDef[] = [
  {
    name: 'Food',
    emoji: '🍽️',
    strong: [
      'food', 'foodie', 'foodies', 'food vlog', 'food walk', 'food tour', 'street food', 'restaurant',
      'cafe', 'eatery', 'eateries', 'dining', 'fine dining', 'cuisine', 'recipe', 'biryani', 'dosa',
      'masala dosa', 'idli', 'vada', 'chaat', 'pani puri', 'golgappa', 'thali', 'buffet', 'brunch',
      'breakfast', 'lunch', 'dinner', 'dessert', 'bakery', 'coffee', 'filter coffee', 'chai',
      'pizza', 'burger', 'sushi', 'momos', 'kebab', 'shawarma', 'pub', 'brewery', 'microbrewery',
      'cocktail', 'cocktails', 'bar hopping', 'chef', 'zomato', 'swiggy', 'must try', 'ice cream',
      'paneer', 'tandoori', 'noodles', 'ramen', 'pasta', 'mutton', 'chicken', 'seafood', 'tiffin',
      'military hotel', 'darshini', 'pongal', 'bisi bele bath', 'parotta', 'paratha',
      'pav bhaji', 'vada pav', 'misal', 'kulfi', 'falooda', 'jalebi', 'mithai', 'sweets',
      'cooking', 'baking', 'eat', 'eats', 'eating', 'delicious', 'tasty', 'yummy', 'menu',
    ],
    weak: ['taste', 'drinks', 'bar', 'hotel', 'spicy', 'order'],
    domains: ['zomato.com', 'swiggy.com', 'eazydiner.com', 'dineout.co.in', 'magicpin.in', 'district.in/dining'],
  },
  {
    name: 'Places to Visit',
    emoji: '🗺️',
    strong: [
      'places to visit', 'place to visit', 'must visit', 'hidden gem', 'hidden gems', 'getaway',
      'weekend getaway', 'trek', 'trekking', 'hike', 'hiking', 'trail', 'waterfall', 'waterfalls',
      'lake', 'beach', 'hill station', 'hills', 'mountain', 'mountains', 'sunrise point',
      'sunset point', 'viewpoint', 'temple', 'fort', 'palace', 'museum', 'heritage', 'sightseeing',
      'itinerary', 'road trip', 'staycation', 'resort', 'homestay', 'camping', 'campsite', 'island',
      'national park', 'wildlife', 'safari', 'sanctuary', 'travel', 'travelling', 'traveling',
      'trip', 'tourist', 'tourism', 'backpacking', 'vacation', 'day trip', 'one day trip',
      'things to do', 'exploring', 'dam', 'cave', 'caves', 'valley',
      'monument', 'landmark', 'scenic', 'hostel', 'airbnb', 'cruise', 'visa', 'flight', 'flights',
    ],
    weak: ['park', 'garden', 'falls', 'holiday', 'explore', 'visit', 'spot', 'spots', 'place', 'places', 'sunset', 'view', 'views', 'weekend', 'nature'],
    domains: [
      'tripadvisor.com', 'tripadvisor.in', 'makemytrip.com', 'goibibo.com', 'cleartrip.com',
      'booking.com', 'airbnb.com', 'airbnb.co.in', 'agoda.com', 'holidify.com', 'thrillophilia.com',
      'maps.google.com', 'maps.app.goo.gl', 'goo.gl/maps', 'google.com/maps', 'google.co.in/maps',
      'maps.apple.com', 'ixigo.com', 'expedia.com', 'lonelyplanet.com',
    ],
  },
  {
    name: 'Apps & Tech',
    emoji: '📱',
    strong: [
      'app', 'apps', 'mobile app', 'play store', 'app store', 'google play', 'android',
      'iphone', 'ios', 'ipad', 'macbook', 'software', 'saas', 'startup', 'startups', 'tech', 'technology',
      'gadget', 'gadgets', 'ai', 'chatgpt', 'llm', 'claude', 'gemini', 'open source', 'github', 'coding',
      'developer', 'developers', 'programming', 'javascript', 'python', 'react native', 'laptop',
      'smartphone', 'website', 'web app', 'browser extension', 'chrome extension', 'productivity tool',
      'automation', 'api', 'upi app', 'fintech',
    ],
    weak: ['feature', 'update', 'beta', 'application', 'download', 'tool', 'tools', 'install', 'launch', 'launched', 'online', 'digital'],
    domains: [
      'play.google.com', 'apps.apple.com', 'github.com', 'producthunt.com', 'techcrunch.com',
      'theverge.com', 'gsmarena.com', 'news.ycombinator.com', 'stackoverflow.com', 'npmjs.com',
    ],
  },
  {
    name: 'Events',
    emoji: '🎉',
    strong: [
      'event', 'events', 'concert', 'gig', 'gigs', 'festival', 'fest', 'standup', 'stand up comedy',
      'stand-up', 'comedy show', 'open mic', 'live music', 'meetup', 'workshop', 'exhibition',
      'flea market', 'pop up', 'popup', 'bookmyshow',
      'sunburn', 'nightlife', 'dj', 'theatre', 'theater', 'screening', 'carnival', 'hackathon',
    ],
    weak: ['party', 'ticket', 'tickets', 'book now', 'expo', 'tonight', 'this weekend', 'saturday', 'sunday', 'live'],
    domains: ['bookmyshow.com', 'insider.in', 'district.in', 'allevents.in', 'meetup.com', 'eventbrite.com', 'skillboxes.com', 'sortmyscene.com'],
  },
  {
    name: 'Shopping',
    emoji: '🛍️',
    strong: [
      'shopping', 'shop', 'shops', 'sale', 'deal', 'deals', 'discount', 'discounts',
      'coupon', 'coupons', 'mall', 'haul', 'unboxing', 'outfit', 'outfits', 'fashion',
      'sneakers', 'shoes', 'clothes', 'clothing', 'saree', 'kurta', 'jewellery', 'jewelry', 'skincare',
      'makeup', 'myntra', 'amazon', 'flipkart', 'meesho', 'ajio', 'nykaa', 'thrift', 'thrift store',
      'wishlist', 'gift', 'gifts',
    ],
    weak: ['market', 'buy', 'offer', 'offers', 'price', 'store', 'brand', 'review', 'order', 'cheap'],
    domains: [
      'amazon.in', 'amazon.com', 'amzn.to', 'amzn.in', 'flipkart.com', 'fkrt.it', 'myntra.com',
      'ajio.com', 'nykaa.com', 'meesho.com', 'tatacliq.com', 'snapdeal.com', 'etsy.com', 'ikea.com',
      'decathlon.in', 'croma.com', 'reliancedigital.in', 'zeptonow.com', 'blinkit.com', 'bigbasket.com',
    ],
  },
  {
    name: 'Movies & Music',
    emoji: '🎬',
    strong: [
      'movie', 'movies', 'film', 'films', 'cinema', 'trailer', 'teaser', 'web series', 'episode',
      'netflix', 'prime video', 'hotstar', 'jiocinema', 'jiohotstar', 'ott', 'song', 'songs',
      'music', 'album', 'playlist', 'spotify', 'podcast', 'anime', 'kdrama', 'k drama', 'bollywood',
      'sandalwood', 'tollywood', 'kollywood', 'box office', 'soundtrack', 'lyrics',
    ],
    weak: ['series', 'season', 'review', 'watch', 'listen', 'show', 'shows'],
    domains: [
      'netflix.com', 'primevideo.com', 'hotstar.com', 'jiocinema.com', 'spotify.com', 'spotify.link',
      'music.youtube.com', 'music.apple.com', 'imdb.com', 'letterboxd.com', 'jiosaavn.com', 'gaana.com',
      'soundcloud.com',
    ],
  },
  {
    name: 'Health & Fitness',
    emoji: '💪',
    strong: [
      'health', 'healthy', 'fitness', 'gym', 'workout', 'workouts', 'exercise', 'yoga', 'meditation',
      'diet', 'nutrition', 'protein', 'weight loss', 'fat loss', 'marathon', 'cycling',
      'doctor', 'hospital', 'clinic', 'wellness', 'mental health', 'therapy', 'sleep', 'skincare routine',
      'physiotherapy', 'calories', 'keto', 'intermittent fasting',
    ],
    weak: ['running', 'run', 'steps', 'stretch', 'muscle'],
    domains: ['healthifyme.com', 'cult.fit', 'practo.com', 'webmd.com'],
  },
  {
    name: 'Money',
    emoji: '💰',
    strong: [
      'money', 'finance', 'personal finance', 'invest', 'investing', 'investment', 'investments',
      'stocks', 'stock market', 'share market', 'mutual fund', 'mutual funds', 'sip', 'nifty', 'sensex',
      'crypto', 'bitcoin', 'tax', 'taxes', 'income tax', 'itr', 'savings', 'budgeting', 'loan',
      'emi', 'credit card', 'credit score', 'cibil', 'insurance', 'upi', 'fixed deposit', 'ipo',
      'dividend', 'wealth', 'salary',
    ],
    weak: ['gold', 'budget', 'portfolio', 'rupees', 'bank', 'cashback', 'returns'],
    domains: ['zerodha.com', 'groww.in', 'moneycontrol.com', 'etmoney.com', 'cred.club', 'paisabazaar.com', 'economictimes.indiatimes.com', 'livemint.com'],
  },
  {
    name: 'Learning',
    emoji: '📚',
    strong: [
      'learn', 'learning', 'course', 'courses', 'tutorial', 'tutorials', 'how to', 'guide', 'explained',
      'books', 'reading list', 'study', 'studying', 'exam', 'exams', 'upsc', 'gate exam',
      'lecture', 'masterclass', 'free course', 'roadmap', 'documentation', 'cheat sheet',
      'research', 'science', 'language learning',
    ],
    weak: ['notes', 'paper', 'history', 'class', 'book', 'tips', 'tricks', 'lesson', 'skills', 'skill'],
    domains: [
      'coursera.org', 'udemy.com', 'edx.org', 'khanacademy.org', 'wikipedia.org', 'medium.com',
      'substack.com', 'arxiv.org', 'freecodecamp.org', 'nptel.ac.in', 'goodreads.com',
    ],
  },
  {
    name: 'Work & Career',
    emoji: '💼',
    strong: [
      'job', 'jobs', 'hiring', 'we are hiring', 'career', 'careers', 'interview', 'interviews', 'resume',
      'cv', 'internship', 'internships', 'linkedin', 'office', 'remote work', 'work from home', 'wfh',
      'freelance', 'freelancing', 'side hustle', 'appraisal', 'layoffs',
      'leadership', 'productivity', 'job opening',
    ],
    weak: ['manager', 'referral', 'promotion', 'work', 'team', 'meeting', 'meetings'],
    domains: ['linkedin.com', 'lnkd.in', 'naukri.com', 'indeed.com', 'glassdoor.com', 'wellfound.com', 'instahyre.com'],
  },
  {
    name: 'Home & Living',
    emoji: '🏠',
    strong: [
      'home decor', 'decor', 'interior', 'interiors', 'interior design', 'furniture', 'apartment',
      'flat for rent', 'for rent', 'rental', 'pg', 'flatmate', 'flatmates', 'house hunting',
      'plants', 'gardening', 'balcony', 'diy', 'cleaning', 'kitchen hacks', 'home hacks',
      'appliances', 'renovation',
    ],
    weak: ['rent', 'home', 'room', 'house'],
    domains: ['nobroker.in', 'magicbricks.com', '99acres.com', 'housing.com', 'urbancompany.com', 'pepperfry.com', 'livspace.com', 'nestaway.com'],
  },
  {
    name: 'Sports',
    emoji: '⚽',
    strong: [
      'cricket', 'ipl', 'rcb', 'csk', 'mi vs', 'football', 'soccer', 'f1', 'formula 1',
      'badminton', 'tennis', 'kabaddi', 'fifa', 'world cup', 'olympics', 'chess', 'wicket',
      'stadium', 'tournament', 'pickleball', 'turf',
    ],
    weak: ['match', 'score', 'goal', 'century', 'team', 'win', 'player'],
    domains: ['espncricinfo.com', 'cricbuzz.com', 'espn.com', 'fifa.com', 'formula1.com'],
  },
  {
    name: 'Memes & Fun',
    emoji: '😂',
    strong: [
      'meme', 'memes', 'lol', 'lmao', 'lmfao', 'rofl', 'funny', 'humor', 'humour', 'joke', 'jokes',
      'relatable', 'troll', 'trolls', 'sarcasm', 'shitpost', 'comedy', 'hilarious', 'prank',
      'dank', 'wholesome', 'cringe',
    ],
    weak: ['roast', 'fun', 'haha', 'hahaha', 'mood'],
    domains: ['9gag.com', 'knowyourmeme.com', 'imgflip.com', 'tenor.com', 'giphy.com'],
    emojiHints: ['😂', '🤣', '😆', '😹', '💀', '😭'],
  },
];
