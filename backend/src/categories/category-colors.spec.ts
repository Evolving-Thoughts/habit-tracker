import {
  AUTO_COLOR_ORDER,
  colorForNewCategory,
  colorOfName,
  CORE_COLORS,
  shownCategoryColors,
  withShownColors,
} from './category-colors';
import type { CampaignColor } from '../todos/campaign-style';

const category = (
  id: number,
  name: string,
  color: CampaignColor | null = null,
) => ({ id, name, color });

describe('colorOfName', () => {
  // The same names and colours as category-mark.spec.ts in the frontend.
  it.each([
    ['Haushalt', 'pine'],
    ['Kreativ', 'pine'],
    ['Sport', 'teal'],
    ['Gesundheit', 'ochre'],
  ])('gives %p the colour %p, as the frontend does', (name, color) => {
    expect(colorOfName(name)).toBe(color);
  });
});

describe('shownCategoryColors', () => {
  it('keeps stored colours and the colour a free name picks', () => {
    const shown = shownCategoryColors([
      category(1, 'Lesen', 'wine'),
      category(2, 'Sport'),
    ]);
    expect([...shown]).toEqual([
      [1, 'wine'],
      [2, 'teal'],
    ]);
  });

  it('never shows two categories alike while a core colour is free', () => {
    // "Haushalt" and "Kreativ" both pick pine; the later one gives way.
    const shown = shownCategoryColors([
      category(5, 'Kreativ'),
      category(2, 'Haushalt'),
      category(3, 'Arbeit', 'indigo'),
    ]);
    expect(shown.get(2)).toBe('pine');
    expect(shown.get(5)).toBe('ochre');
    expect(shown.get(3)).toBe('indigo');
  });

  it('gives way to a stored colour, whichever came first', () => {
    const shown = shownCategoryColors([
      category(1, 'Sport'),
      category(2, 'Musik', 'teal'),
    ]);
    expect(shown.get(1)).toBe('indigo');
    expect(shown.get(2)).toBe('teal');
  });

  it('falls back to the name once every core colour is taken', () => {
    const full = CORE_COLORS.map((color, index) =>
      category(index + 1, `K${index}`, color),
    );
    expect(shownCategoryColors([...full, category(20, 'Sport')]).get(20)).toBe(
      'teal',
    );
  });

  it('puts the shown colour in place of the stored one', () => {
    expect(
      withShownColors([{ ...category(1, 'Sport'), weeklyTarget: 3 }]),
    ).toEqual([{ id: 1, name: 'Sport', color: 'teal', weeklyTarget: 3 }]);
  });
});

describe('colorForNewCategory', () => {
  it('takes the first core colour no category shows', () => {
    expect(colorForNewCategory('Kreativ', [])).toBe('indigo');
    expect(
      colorForNewCategory('Kreativ', [
        category(1, 'Haushalt'),
        category(2, 'Lesen', 'indigo'),
      ]),
    ).toBe('ochre');
  });

  it('picks in the order that keeps consecutive colours apart', () => {
    // The same list as AUTO_COLOR_ORDER in the frontend's category-mark.ts.
    expect(AUTO_COLOR_ORDER).toEqual([
      'indigo',
      'ochre',
      'plum',
      'walnut',
      'navy',
      'berry',
      'pine',
      'teal',
    ]);
    expect([...AUTO_COLOR_ORDER].sort()).toEqual([...CORE_COLORS].sort());
    const picked: ReturnType<typeof category>[] = [];
    for (const name of [
      'Gesundheit',
      'Lernen',
      'Haushalt',
      'Arbeit',
      'Kreativ',
    ])
      picked.push(
        category(picked.length + 1, name, colorForNewCategory(name, picked)),
      );
    expect(picked.map((item) => item.color)).toEqual([
      'indigo',
      'ochre',
      'plum',
      'walnut',
      'navy',
    ]);
  });

  it('takes the colour of the name once all core colours are used', () => {
    const full = CORE_COLORS.map((color, index) =>
      category(index + 1, `K${index}`, color),
    );
    expect(colorForNewCategory('Sport', full)).toBe('teal');
  });
});
