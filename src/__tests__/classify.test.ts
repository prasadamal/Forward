import { classify, corpusOf } from '../organizer/classify';
import { extractHashtags, normalizeText, phraseVariants } from '../organizer/text';

describe('normalizeText', () => {
  it('lowercases, strips accents and punctuation, pads with spaces', () => {
    expect(normalizeText("Bangalore's BEST Café!!")).toBe(' bangalore s best cafe ');
  });

  it('turns hashtags, underscores and emoji into word separators', () => {
    expect(normalizeText('#bangalore_food 😂lol')).toBe(' bangalore food lol ');
  });

  it('handles empty input', () => {
    expect(normalizeText(undefined)).toBe(' ');
  });
});

describe('extractHashtags', () => {
  it('returns unique lowercase tags without #', () => {
    expect(extractHashtags('#BangaloreFood is #bangalorefood and #Weekend_Getaway #2024')).toEqual([
      'bangalorefood',
      'weekend_getaway',
    ]);
  });
});

describe('phraseVariants', () => {
  it('adds simple plurals', () => {
    expect(phraseVariants('cafe')).toEqual(['cafe', 'cafes']);
    expect(phraseVariants('city')).toEqual(['city', 'cities']);
    expect(phraseVariants('beach')).toEqual(['beach', 'beaches']);
    expect(phraseVariants('street food')).toEqual(['street food', 'street foods']);
  });
});

describe('classify — the Bangalore examples', () => {
  it('files a YouTube food vlog under Bangalore › Food', () => {
    const c = classify({
      title: "Bangalore's BEST Street Food Tour 🇮🇳 | VV Puram Food Street",
      author: 'Food Ranger',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
    expect(c.place?.place.name).toBe('Bangalore');
    expect(c.topic?.topic.name).toBe('Food');
  });

  it('files an Instagram spot under Bangalore › Places to Visit', () => {
    const c = classify({
      title: 'This hidden lake near Bengaluru is perfect for sunsets 🌅',
      text: '#bangaloretrips #weekendgetaway #nature',
      url: 'https://www.instagram.com/reel/C9xYz12AbCd/',
    });
    expect(c.place?.place.name).toBe('Bangalore');
    expect(c.topic?.topic.name).toBe('Places to Visit');
  });

  it('files an X post about an app under Bangalore › Apps & Tech', () => {
    const c = classify({
      title: 'Finally an app that shows live BMTC bus locations in Bangalore 🚌',
      text: 'Download Namma Transit from the Play Store',
      url: 'https://x.com/someone/status/1234567890',
    });
    expect(c.place?.place.name).toBe('Bangalore');
    expect(c.topic?.topic.name).toBe('Apps & Tech');
  });
});

describe('classify — places', () => {
  it('maps neighbourhoods to their city', () => {
    const c = classify({ title: 'Best brunch spots in Koramangala' });
    expect(c.place?.place.name).toBe('Bangalore');
    expect(c.tags).toContain('koramangala');
  });

  it('understands aliases', () => {
    expect(classify({ title: 'Weekend in Bombay' }).place?.place.name).toBe('Mumbai');
    expect(classify({ title: 'Namma Bengaluru traffic' }).place?.place.name).toBe('Bangalore');
  });

  it('reads compound hashtags', () => {
    const c = classify({ text: 'so good #bangalorefoodie' });
    expect(c.place?.place.name).toBe('Bangalore');
    expect(c.topic?.topic.name).toBe('Food');
  });

  it('reads place names from URL paths', () => {
    const c = classify({ url: 'https://www.zomato.com/bangalore/truffles-koramangala-5th-block' });
    expect(c.place?.place.name).toBe('Bangalore');
    expect(c.topic?.topic.name).toBe('Food');
  });

  it('prefers the city over its state when both are mentioned', () => {
    const c = classify({ title: 'Mysore Palace, Mysuru, Karnataka' });
    expect(c.place?.place.name).toBe('Mysore');
  });

  it('needs a strong signal before filing by country', () => {
    expect(classify({ text: 'the best UPI app in India' }).place).toBeUndefined();
    expect(classify({ title: 'Incredible India: 10 places to visit' }).place?.place.name).toBe('India');
  });

  it('does not match places inside other words', () => {
    expect(classify({ title: 'Goalkeeper training drills' }).place).toBeUndefined();
    expect(classify({ title: 'Pani puri recipe' }).place).toBeUndefined();
  });
});

describe('classify — topics', () => {
  it('matches on word boundaries only', () => {
    // "great" contains "eat", "happy" contains "app"
    expect(classify({ title: 'What a great and happy day' }).topic).toBeUndefined();
  });

  it('uses known domains', () => {
    expect(classify({ url: 'https://play.google.com/store/apps/details?id=com.example' }).topic?.topic.name).toBe(
      'Apps & Tech',
    );
    expect(classify({ url: 'https://in.bookmyshow.com/events/some-show/ET001' }).topic?.topic.name).toBe('Events');
  });

  it('weak keywords alone are not enough', () => {
    expect(classify({ text: 'visit my profile' }).topic).toBeUndefined();
  });

  it('recognises memes from emoji', () => {
    expect(classify({ text: 'me on monday 😂😂' }).topic?.topic.name).toBe('Memes & Fun');
  });

  it('returns no topic or place for unrelated text', () => {
    const c = classify({ title: 'asdf qwerty' });
    expect(c.place).toBeUndefined();
    expect(c.topic).toBeUndefined();
    expect(c.tags).toEqual([]);
  });
});

// The shares that misfiled in Forward 1.x, which matched keywords as substrings
// ("inst*agra*m", "w*eat*her", "*bar*celona", "pr*emi*um", "h*app*y").
describe('classify — v1 substring bugs stay fixed', () => {
  const placeOf = (text: string, url?: string) => classify({ text, url }).place?.place.name;
  const topicOf = (text: string, url?: string) => classify({ text, url }).topic?.topic.name;

  it('does not file Instagram links under Agra', () => {
    expect(placeOf('Funny cat video', 'https://www.instagram.com/reel/xyz/')).toBeUndefined();
    expect(placeOf('Funny cat video instagram.com/reel/xyz')).toBeUndefined();
  });

  it('does not find food in "weather" or "Barcelona"', () => {
    expect(placeOf('Weather update: heavy rain in Kerala tonight')).toBe('Kerala');
    expect(topicOf('Weather update: heavy rain in Kerala tonight')).toBeUndefined();
    expect(topicOf('Barcelona vs Real Madrid highlights')).toBe('Sports');
  });

  it('does not find money in "premium" or fun in "happy"', () => {
    expect(topicOf('My premium academic planner template')).toBeUndefined();
    const t = classify({ text: 'This startup’s smart strategy for happy customers' }).topics.map(m => m.topic.name);
    expect(t).not.toContain('Memes & Fun');
    expect(t).not.toContain('Movies & Music');
  });

  it('still gets the easy one right', () => {
    expect(placeOf('Best biryani in Hyderabad')).toBe('Hyderabad');
    expect(topicOf('Best biryani in Hyderabad')).toBe('Food');
  });
});

describe('classify — Indian cities, treks and look-alikes', () => {
  const placeOf = (title: string) => classify({ title }).place?.place.name;

  it('knows more Indian cities and their old names', () => {
    expect(placeOf('Kozhikode beach food street')).toBe('Kozhikode');
    expect(placeOf('Halwa shops in Calicut')).toBe('Kozhikode');
    expect(placeOf('Thrissur Pooram 2026 dates')).toBe('Thrissur');
    expect(placeOf('Weekend in Trichy')).toBe('Tiruchirappalli');
    expect(placeOf('Kumbh Mela at Prayagraj')).toBe('Prayagraj');
    expect(placeOf('Café in Fort Kochi with a sunset view')).toBe('Kochi');
  });

  it('files treks under the place they start from', () => {
    expect(placeOf('Hampta Pass trek in June')).toBe('Manali');
    expect(placeOf('Valley of Flowers trek guide')).toBe('Uttarakhand');
    expect(placeOf('Kheerganga trek for beginners')).toBe('Kasol');
    expect(placeOf('Chadar trek packing list')).toBe('Leh');
    expect(placeOf('Goechala trek in October')).toBe('Sikkim');
  });

  it('prefers the longer place name', () => {
    expect(placeOf('Flats in Navi Mumbai under 50 lakh')).toBe('Navi Mumbai');
    expect(placeOf('Jammu and Kashmir travel advisory')).toBe('Kashmir');
  });

  it('ignores place names inside teams, films, brands and dishes', () => {
    expect(placeOf('Mumbai Indians vs Chennai Super Kings highlights')).toBeUndefined();
    expect(classify({ title: 'Mumbai Indians vs Chennai Super Kings highlights' }).topic?.topic.name).toBe('Sports');
    expect(placeOf('Mysore Pak recipe in 10 minutes')).toBeUndefined();
    expect(placeOf('Dubai chocolate bar at home')).toBeUndefined();
    expect(placeOf('Rewatching Bangalore Days')).toBeUndefined();
    expect(classify({ title: 'Recipe', text: '#mysorepak #sweets' }).place).toBeUndefined();
  });

  it('still files the place when it is mentioned on its own too', () => {
    expect(placeOf('The best Mysore Pak is at Guru Sweets in Mysore')).toBe('Mysore');
  });

  it('prefers where something is over where its style comes from', () => {
    expect(placeOf('Best Kolkata biryani in Bangalore')).toBe('Bangalore');
    expect(placeOf('Mumbai style vada pav at Indiranagar')).toBe('Bangalore');
    expect(placeOf('Day trip from Bangalore to Mysore')).toBe('Mysore');
    expect(placeOf('Chicken Madras recipe')).toBeUndefined();
    expect(placeOf('Florence Pugh’s new film')).toBeUndefined();
  });

  it('only matches ambiguous names through their aliases', () => {
    expect(placeOf('Pani puri at home')).toBeUndefined();
    expect(placeOf('Jagannath Puri Rath Yatra')).toBe('Puri');
    expect(placeOf('Juicy roast turkey')).toBeUndefined();
    expect(placeOf('Cappadocia balloons, Turkey trip')).toBe('Turkey');
    expect(placeOf('Badami milk recipe')).toBeUndefined();
  });
});

describe('corpusOf', () => {
  it('combines all fields into one normalised string', () => {
    const corpus = corpusOf({ title: 'Hello', text: 'World', url: 'https://a.com/goa-trip' });
    expect(corpus).toContain(' hello ');
    expect(corpus).toContain(' world ');
    expect(corpus).toContain(' goa trip ');
  });
});
