import { classify, corpusOf, ClassifyInput } from '../organizer/classify';
import { planFiling, placeKey, topicKey } from '../organizer/autoFile';
import { Folder } from '../types';

function folder(id: string, parentId: string | null, name: string, extra: Partial<Folder> = {}): Folder {
  return {
    id,
    parentId,
    name,
    emoji: '📁',
    color: '#000',
    keywords: [],
    auto: false,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  };
}

function plan(input: ClassifyInput, folders: Folder[]) {
  return planFiling(classify(input), folders, corpusOf(input));
}

const vlog = { title: 'Best street food in Bangalore | VV Puram', url: 'https://youtu.be/dQw4w9WgXcQ' };

describe('planFiling', () => {
  it('creates Place › Topic folders when none exist', () => {
    const p = plan(vlog, []);
    expect(p.create.map(c => [c.key, c.parentId, c.name, c.smartKey])).toEqual([
      ['new:0', null, 'Bangalore', placeKey('Bangalore')],
      ['new:1', 'new:0', 'Food', topicKey('Food')],
    ]);
    expect(p.targets).toEqual(['new:1']);
  });

  it('reuses an existing place folder anywhere in the tree, even renamed via smart key', () => {
    const folders = [
      folder('trips', null, 'Trips'),
      folder('blr', 'trips', 'Namma Ooru', { smartKey: placeKey('Bangalore') }),
    ];
    const p = plan(vlog, folders);
    expect(p.create).toEqual([expect.objectContaining({ parentId: 'blr', name: 'Food' })]);
    expect(p.targets).toEqual(['new:0']);
  });

  it('reuses a user folder named with an alias', () => {
    const p = plan(vlog, [folder('b', null, 'Bengaluru')]);
    expect(p.create.map(c => c.parentId)).toEqual(['b']);
  });

  it('reuses an existing topic subfolder', () => {
    const folders = [folder('blr', null, 'Bangalore'), folder('food', 'blr', 'Food')];
    const p = plan(vlog, folders);
    expect(p.create).toEqual([]);
    expect(p.targets).toEqual(['food']);
  });

  it('files topic-only items into a top-level topic folder', () => {
    const p = plan({ title: 'Easy paneer butter masala recipe' }, []);
    expect(p.create.map(c => [c.parentId, c.name])).toEqual([[null, 'Food']]);
    expect(p.targets).toEqual(['new:0']);
  });

  it('leaves unrecognised items in the Inbox', () => {
    expect(plan({ title: 'zxcv' }, [])).toEqual({ create: [], targets: [] });
  });

  it('adds folders whose keyword rules match', () => {
    const folders = [folder('weekend', null, 'Weekend plans', { keywords: ['this weekend'] })];
    const p = plan({ title: 'Street food walk in Bangalore this weekend' }, folders);
    expect(p.targets).toEqual(['weekend', 'new:1']);
  });

  it('drops a matching folder that is an ancestor of the chosen one', () => {
    const folders = [
      folder('india', null, 'India trips', { keywords: ['bangalore'] }),
      folder('blr', 'india', 'Bangalore'),
    ];
    const p = plan(vlog, folders);
    // Food is created inside Bangalore, which is inside "India trips": only the new folder remains.
    expect(p.targets).toEqual(['new:0']);
  });

  it('can skip topic subfolders when a place matched', () => {
    const p = planFiling(classify(vlog), [], corpusOf(vlog), { topicSubfolders: false });
    expect(p.create.map(c => c.name)).toEqual(['Bangalore']);
  });
});
