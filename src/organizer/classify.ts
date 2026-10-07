import { PLACES, PlaceDef } from './places';
import { TOPICS, TopicDef } from './topics';
import { extractHashtags, normalizePhrase, normalizeText, phraseVariants } from './text';
import { matchesDomain, urlPathWords } from '../ingest/urls';

/**
 * On-device classifier. Given what we know about an item (title, caption,
 * link, channel name) it guesses the place it's about and its topic, e.g.
 * "Bangalore's best street food | VV Puram" → place: Bangalore, topic: Food.
 *
 * It is deliberately simple and transparent: phrase matching on word
 * boundaries with per-field weights. No network calls, no ML models.
 */

export interface ClassifyInput {
  title?: string;
  /** Caption, description, or the note the user typed. */
  text?: string;
  url?: string;
  /** Channel, account or site name. */
  author?: string;
}

export interface PlaceMatch {
  place: PlaceDef;
  score: number;
  /** Phrases that matched, e.g. ["bengaluru", "koramangala"]. */
  matched: string[];
  firstIndex: number;
}

export interface TopicMatch {
  topic: TopicDef;
  score: number;
  matched: string[];
  firstIndex: number;
}

export interface Classification {
  place?: PlaceMatch;
  topic?: TopicMatch;
  places: PlaceMatch[];
  topics: TopicMatch[];
  tags: string[];
}

type FieldName = 'title' | 'text' | 'author' | 'url';

const FIELD_WEIGHT: Record<FieldName, number> = { title: 3, text: 2, author: 1.5, url: 1.5 };
const HASHTAG_EXACT = 2;
const HASHTAG_COMPOUND = 2;
const DOMAIN_SCORE = 3;
const EMOJI_SCORE = 2;
const PLACE_MIN_SCORE = 1.5;
const COUNTRY_MIN_SCORE = 3;
const TOPIC_MIN_SCORE = 2;

interface PhraseEntry {
  words: string[];
  phrase: string;
  /** Index into PLACES or TOPICS. */
  target: number;
  /** 1 for strong keywords and place names, 0.5 for weak keywords. */
  weight: number;
}

interface PhraseIndex {
  byFirstWord: Map<string, PhraseEntry[]>;
  /** Entries keyed by the phrase with spaces removed, for hashtag matching. */
  joined: { key: string; entry: PhraseEntry }[];
}

function buildIndex(entries: PhraseEntry[]): PhraseIndex {
  const byFirstWord = new Map<string, PhraseEntry[]>();
  const joined: { key: string; entry: PhraseEntry }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const dedupeKey = `${e.target}|${e.phrase}`;
    if (!e.phrase || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const list = byFirstWord.get(e.words[0]) ?? [];
    list.push(e);
    byFirstWord.set(e.words[0], list);
    joined.push({ key: e.words.join(''), entry: e });
  }
  return { byFirstWord, joined };
}

function entry(phrase: string, target: number, weight: number): PhraseEntry {
  const norm = normalizePhrase(phrase);
  return { phrase: norm, words: norm.split(' '), target, weight };
}

let placeIndex: PhraseIndex | null = null;
let topicIndex: PhraseIndex | null = null;

function getPlaceIndex(): PhraseIndex {
  if (!placeIndex) {
    const entries: PhraseEntry[] = [];
    PLACES.forEach((p, i) => {
      for (const name of [p.name, ...(p.aliases ?? []), ...(p.areas ?? [])]) {
        entries.push(entry(name, i, 1));
      }
    });
    placeIndex = buildIndex(entries);
  }
  return placeIndex;
}

function getTopicIndex(): PhraseIndex {
  if (!topicIndex) {
    const entries: PhraseEntry[] = [];
    TOPICS.forEach((t, i) => {
      for (const kw of t.strong) {
        for (const v of phraseVariants(normalizePhrase(kw))) entries.push(entry(v, i, 1));
      }
      for (const kw of t.weak ?? []) {
        for (const v of phraseVariants(normalizePhrase(kw))) entries.push(entry(v, i, 0.5));
      }
    });
    topicIndex = buildIndex(entries);
  }
  return topicIndex;
}

interface Hit {
  target: number;
  weight: number;
  phrase: string;
  position: number;
}

/** Find every indexed phrase occurring in a list of tokens. */
function scan(tokens: string[], index: PhraseIndex, positionOffset: number): Hit[] {
  const hits: Hit[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const candidates = index.byFirstWord.get(tokens[i]);
    if (!candidates) continue;
    for (const c of candidates) {
      if (i + c.words.length > tokens.length) continue;
      let ok = true;
      for (let k = 1; k < c.words.length; k++) {
        if (tokens[i + k] !== c.words[k]) {
          ok = false;
          break;
        }
      }
      if (ok) hits.push({ target: c.target, weight: c.weight, phrase: c.phrase, position: positionOffset + i });
    }
  }
  return hits;
}

/** Hashtag hits for joined (#streetfood) and compound (#bangalorefoodie) tags. */
function scanHashtags(tags: string[], index: PhraseIndex, minCompoundLength: number): Hit[] {
  const hits: Hit[] = [];
  tags.forEach((rawTag, tagIndex) => {
    const parts = rawTag.split('_').filter(Boolean);
    const tag = parts.join('');
    for (const { key, entry: e } of index.joined) {
      if (key.length < 3) continue;
      if (tag === key) {
        // Single-word exact tags are already counted via the text fields.
        if (e.words.length > 1) hits.push({ target: e.target, weight: e.weight * HASHTAG_EXACT, phrase: e.phrase, position: 10_000 + tagIndex });
        continue;
      }
      if (parts.length > 1 && parts.includes(key)) {
        hits.push({ target: e.target, weight: e.weight * HASHTAG_EXACT, phrase: e.phrase, position: 10_000 + tagIndex });
        continue;
      }
      if (key.length < minCompoundLength) continue;
      const compound =
        tag.startsWith(key) || tag.endsWith(key) || (key.length >= 7 && tag.includes(key));
      if (compound) {
        hits.push({ target: e.target, weight: e.weight * HASHTAG_COMPOUND, phrase: e.phrase, position: 10_000 + tagIndex });
      }
    }
  });
  return hits;
}

interface Accumulator {
  score: number;
  matched: string[];
  firstIndex: number;
}

function accumulate(
  fields: { name: FieldName; tokens: string[]; offset: number }[],
  hashtagHits: Hit[],
  index: PhraseIndex,
): Map<number, Accumulator> {
  const acc = new Map<number, Accumulator>();
  const touch = (target: number): Accumulator => {
    let a = acc.get(target);
    if (!a) {
      a = { score: 0, matched: [], firstIndex: Number.MAX_SAFE_INTEGER };
      acc.set(target, a);
    }
    return a;
  };

  for (const field of fields) {
    const hits = scan(field.tokens, index, field.offset);
    // Per target: the best phrase weight in this field, plus a small bonus for
    // several distinct phrases ("biryani" + "street food" + "restaurant").
    const perTarget = new Map<number, Hit[]>();
    for (const h of hits) perTarget.set(h.target, [...(perTarget.get(h.target) ?? []), h]);
    for (const [target, targetHits] of perTarget) {
      const a = touch(target);
      const best = Math.max(...targetHits.map(h => h.weight));
      const distinct = new Set(targetHits.filter(h => h.weight === 1).map(h => h.phrase)).size;
      const bonus = Math.min(1, Math.max(0, distinct - 1) * 0.25);
      a.score += best * FIELD_WEIGHT[field.name] + bonus;
      for (const h of targetHits) {
        if (!a.matched.includes(h.phrase)) a.matched.push(h.phrase);
        a.firstIndex = Math.min(a.firstIndex, h.position);
      }
    }
  }

  // Hashtags count once per target.
  const tagBest = new Map<number, Hit>();
  for (const h of hashtagHits) {
    const prev = tagBest.get(h.target);
    if (!prev || h.weight > prev.weight) tagBest.set(h.target, h);
  }
  for (const [target, h] of tagBest) {
    const a = touch(target);
    a.score += h.weight;
    if (!a.matched.includes(h.phrase)) a.matched.push(h.phrase);
    a.firstIndex = Math.min(a.firstIndex, h.position);
  }
  return acc;
}

function tokens(s: string | undefined): string[] {
  const norm = normalizeText(s).trim();
  return norm ? norm.split(' ') : [];
}

export function classify(input: ClassifyInput): Classification {
  const title = tokens(input.title);
  const text = tokens(input.text);
  const author = tokens(input.author);
  const url = tokens(urlPathWords(input.url).join(' '));

  // Offsets keep positions comparable across fields (title first).
  const fields = [
    { name: 'title' as const, tokens: title, offset: 0 },
    { name: 'text' as const, tokens: text, offset: 1_000 },
    { name: 'author' as const, tokens: author, offset: 5_000 },
    { name: 'url' as const, tokens: url, offset: 6_000 },
  ];
  const hashtags = extractHashtags(`${input.title ?? ''} ${input.text ?? ''}`);

  // ── Places ──
  const pIndex = getPlaceIndex();
  const placeAcc = accumulate(fields, scanHashtags(hashtags, pIndex, 5), pIndex);
  const places: PlaceMatch[] = [...placeAcc.entries()]
    .map(([i, a]) => ({ place: PLACES[i], score: round(a.score), matched: a.matched, firstIndex: a.firstIndex, order: i }))
    .filter(m => m.score >= (m.place.level === 1 ? COUNTRY_MIN_SCORE : PLACE_MIN_SCORE))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.place.level - a.place.level ||
        a.firstIndex - b.firstIndex ||
        a.order - b.order,
    )
    .map(({ order: _order, ...m }) => m);

  // ── Topics ──
  const tIndex = getTopicIndex();
  const topicAcc = accumulate(fields, scanHashtags(hashtags, tIndex, 4), tIndex);
  const rawText = `${input.title ?? ''} ${input.text ?? ''}`;
  TOPICS.forEach((topic, i) => {
    const extra: { score: number; label: string }[] = [];
    if (input.url && topic.domains?.length && matchesDomain(input.url, topic.domains)) {
      extra.push({ score: DOMAIN_SCORE, label: 'site' });
    }
    if (topic.emojiHints?.some(e => rawText.includes(e))) {
      extra.push({ score: EMOJI_SCORE, label: 'emoji' });
    }
    if (!extra.length) return;
    const a = topicAcc.get(i) ?? { score: 0, matched: [], firstIndex: 9_000 };
    for (const x of extra) a.score += x.score;
    topicAcc.set(i, a);
  });
  const topics: TopicMatch[] = [...topicAcc.entries()]
    .map(([i, a]) => ({ topic: TOPICS[i], score: round(a.score), matched: a.matched, firstIndex: a.firstIndex, order: i }))
    .filter(m => m.score >= TOPIC_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.firstIndex - b.firstIndex || a.order - b.order)
    .map(({ order: _order, ...m }) => m);

  const place = places[0];
  const topic = topics[0];

  // ── Tags ──
  const tags: string[] = [];
  const addTag = (t: string) => {
    const clean = t.trim().toLowerCase();
    if (clean && clean.length <= 30 && !tags.includes(clean)) tags.push(clean);
  };
  if (place) {
    addTag(place.place.name);
    for (const m of place.matched) {
      if (normalizePhrase(place.place.name) !== m) addTag(m);
    }
  }
  if (topic) {
    addTag(topic.topic.name);
    topic.matched.slice(0, 3).forEach(addTag);
  }
  hashtags.slice(0, 5).forEach(addTag);

  return { place, topic, places, topics, tags: tags.slice(0, 10) };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Normalised text of everything we know about an item, for keyword rules. */
export function corpusOf(input: ClassifyInput): string {
  return normalizeText(
    [input.title, input.text, input.author, urlPathWords(input.url).join(' ')].filter(Boolean).join(' \n '),
  );
}
