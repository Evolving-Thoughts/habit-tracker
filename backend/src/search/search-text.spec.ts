import {
  containsPattern,
  findMatch,
  notesPlainText,
  shortDate,
  snippetAround,
  weekSpan,
} from './search-text';

describe('search text', () => {
  describe('findMatch', () => {
    it('ignores case and accents and gives offsets into the original', () => {
      const text = 'Kapitel 2 Überarbeiten';
      expect(findMatch(text, 'uberarb')).toEqual({ start: 10, end: 17 });
      expect(text.slice(10, 17)).toBe('Überarb');
      expect(findMatch(text, 'KAPITEL')).toEqual({ start: 0, end: 7 });
    });

    it('matches ß as ss in both directions', () => {
      expect(findMatch('Große Straße', 'strasse')).toEqual({
        start: 6,
        end: 12,
      });
      expect(findMatch('Grosse Strasse', 'groß')).toEqual({
        start: 0,
        end: 5,
      });
    });

    it('collapses whitespace in the query and finds nothing missing', () => {
      expect(findMatch('Buch schreiben', '  buch   schr ')).toEqual({
        start: 0,
        end: 9,
      });
      expect(findMatch('Buch', 'Heft')).toBeNull();
      expect(findMatch('Buch', '   ')).toBeNull();
    });

    it('keeps characters outside the basic plane whole', () => {
      const text = '🎯 Ziel erreicht';
      const match = findMatch(text, 'ziel')!;
      expect(text.slice(match.start, match.end)).toBe('Ziel');
    });
  });

  it('escapes LIKE wildcards in the pattern', () => {
    expect(containsPattern(' 100%_\\ ')).toBe('%100\\%\\_\\\\%');
  });

  it('reads a notes document as plain text, marks joined, blocks apart', () => {
    expect(
      notesPlainText({
        content: [
          {
            type: 'heading',
            content: [
              { type: 'text', text: 'Kap', marks: [{ type: 'bold' }] },
              { type: 'text', text: 'itel' },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', text: 'erst' },
                      { type: 'hardBreak' },
                      { type: 'text', text: 'dann' },
                    ],
                  },
                ],
              },
            ],
          },
          { type: 'paragraph', content: [{ type: 'text', text: 'Ende' }] },
        ],
      }),
    ).toBe('Kapitel erst dann Ende');
    expect(notesPlainText(null)).toBe('');
  });

  describe('snippetAround', () => {
    const long =
      'Am Anfang stand ein langer Satz über das Wetter, dann kam endlich das Kapitel über Drachen und am Ende noch viel mehr Text, der nicht hineinpasst.';

    it('keeps a short text whole', () => {
      expect(snippetAround('Kurz und gut', { start: 5, end: 8 })).toEqual({
        snippet: 'Kurz und gut',
        highlight: { start: 5, end: 8 },
      });
    });

    it('cuts around the match at word boundaries with ellipses', () => {
      const match = findMatch(long, 'kapitel')!;
      const { snippet, highlight } = snippetAround(long, match, 40);
      expect(snippet.startsWith('… ')).toBe(true);
      expect(snippet.endsWith(' …')).toBe(true);
      expect(snippet.slice(highlight!.start, highlight!.end)).toBe('Kapitel');
      expect(snippet.length).toBeLessThanOrEqual(40 + 4);
      // No word is cut in two.
      const inner = snippet.slice(2, -2);
      expect(long).toContain(` ${inner} `);
    });

    it('gives the room one side does not need to the other', () => {
      const match = findMatch(long, 'anfang')!;
      const { snippet, highlight } = snippetAround(long, match, 40);
      expect(snippet.startsWith('Am Anfang')).toBe(true);
      expect(snippet.slice(highlight!.start, highlight!.end)).toBe('Anfang');
      expect(snippet.length).toBeGreaterThan(30);
    });

    it('starts at the beginning without a match', () => {
      const { snippet, highlight } = snippetAround(long, null, 40);
      expect(highlight).toBeNull();
      expect(snippet.startsWith('Am Anfang')).toBe(true);
      expect(snippet.endsWith(' …')).toBe(true);
    });
  });

  it('names days and weeks the way the app does', () => {
    expect(shortDate('2026-11-18', '2026-11-20')).toBe('18. Nov.');
    expect(shortDate('2025-03-04', '2026-11-20')).toBe('4. März 2025');
    expect(weekSpan('2026-11-16', '2026-11-22', '2026-11-20')).toBe(
      '16.–22. Nov.',
    );
    expect(weekSpan('2026-11-30', '2026-12-06', '2026-11-20')).toBe(
      '30. Nov. – 6. Dez.',
    );
  });
});
