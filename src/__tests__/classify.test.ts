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

describe('corpusOf', () => {
  it('combines all fields into one normalised string', () => {
    const corpus = corpusOf({ title: 'Hello', text: 'World', url: 'https://a.com/goa-trip' });
    expect(corpus).toContain(' hello ');
    expect(corpus).toContain(' world ');
    expect(corpus).toContain(' goa trip ');
  });
});
