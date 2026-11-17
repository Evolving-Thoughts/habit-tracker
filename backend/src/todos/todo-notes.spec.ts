import {
  cleanNotes,
  InvalidNotesError,
  NOTES_MAX_LENGTH,
  NotesNode,
} from './todo-notes';

const doc = (...content: NotesNode[]) => ({ type: 'doc' as const, content });
const text = (value: string, marks?: NotesNode['marks']): NotesNode =>
  marks ? { type: 'text', text: value, marks } : { type: 'text', text: value };
const paragraph = (...content: NotesNode[]): NotesNode => ({
  type: 'paragraph',
  content,
});

describe('cleanNotes', () => {
  it('keeps everything the editor can write', () => {
    const written = doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('Plan')] },
      paragraph(
        text('Fett', [{ type: 'bold' }, { type: 'italic' }]),
        text(' und '),
        text('ein Link', [
          { type: 'link', attrs: { href: 'https://example.org/a?b=c' } },
        ]),
        { type: 'hardBreak' },
        text('Code', [{ type: 'code' }]),
      ),
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true },
            content: [paragraph(text('Erledigt'))],
          },
        ],
      },
      {
        type: 'orderedList',
        attrs: { start: 3 },
        content: [{ type: 'listItem', content: [paragraph(text('Drei'))] }],
      },
      { type: 'blockquote', content: [paragraph(text('Zitat'))] },
      {
        type: 'codeBlock',
        attrs: { language: 'ts' },
        content: [text('const a = 1;')],
      },
      { type: 'horizontalRule' },
    );
    expect(cleanNotes(written)).toEqual(written);
  });

  it('treats a document without any text as no notes', () => {
    expect(cleanNotes(null)).toBeNull();
    expect(cleanNotes({ type: 'doc' })).toBeNull();
    expect(cleanNotes(doc({ type: 'paragraph' }))).toBeNull();
    expect(cleanNotes(doc(paragraph(text('   '))))).toBeNull();
    expect(cleanNotes(doc({ type: 'horizontalRule' }))).toBeNull();
  });

  it('drops nodes, marks and attributes the editor does not know', () => {
    expect(
      cleanNotes(
        doc(
          { type: 'iframe', attrs: { src: 'https://evil.example' } },
          {
            type: 'paragraph',
            attrs: { onclick: 'alert(1)', style: 'position:fixed' },
            content: [
              text('bleibt', [
                { type: 'bold', attrs: { class: 'x' } },
                { type: 'script' },
              ]),
              { type: 'image', attrs: { src: 'x' } },
            ],
          },
        ),
      ),
    ).toEqual(doc(paragraph(text('bleibt', [{ type: 'bold' }]))));
  });

  it('only keeps links that lead to the web or to a mail address', () => {
    const link = (href: unknown) =>
      cleanNotes(
        doc(paragraph(text('x', [{ type: 'link', attrs: { href } }]))),
      )!.content[0].content![0].marks;
    expect(link('https://example.org')).toEqual([
      { type: 'link', attrs: { href: 'https://example.org' } },
    ]);
    expect(link('mailto:a@example.org')).toHaveLength(1);
    expect(link('javascript:alert(1)')).toBeUndefined();
    expect(link(' JavaScript:alert(1)')).toBeUndefined();
    expect(link('data:text/html,x')).toBeUndefined();
    expect(link(undefined)).toBeUndefined();
    expect(link(`https://example.org/${'a'.repeat(2000)}`)).toBeUndefined();
  });

  it('brings attributes back into their range', () => {
    const cleaned = cleanNotes(
      doc(
        { type: 'heading', attrs: { level: 9 }, content: [text('H')] },
        {
          type: 'codeBlock',
          attrs: { language: '"><script>' },
          content: [text('c')],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: 'yes' },
              content: [paragraph(text('t'))],
            },
          ],
        },
      ),
    )!;
    expect(cleaned.content[0].attrs).toEqual({ level: 1 });
    expect(cleaned.content[1].attrs).toEqual({ language: null });
    expect(cleaned.content[2].content![0].attrs).toEqual({ checked: false });
  });

  it('cuts off what is nested deeper than any real document', () => {
    let node: NotesNode = paragraph(text('tief'));
    for (let level = 0; level < 40; level++)
      node = { type: 'blockquote', content: [node] };
    expect(cleanNotes(doc(node, paragraph(text('oben'))))).not.toBeNull();
    expect(
      JSON.stringify(cleanNotes(doc(node, paragraph(text('oben'))))),
    ).not.toContain('tief');
  });

  it('rejects what is not a document or is too long', () => {
    for (const input of [
      'text',
      5,
      [],
      { type: 'paragraph' },
      { type: 'doc', content: 'x' },
    ])
      expect(() => cleanNotes(input)).toThrow(InvalidNotesError);
    expect(() =>
      cleanNotes(doc(paragraph(text('a'.repeat(NOTES_MAX_LENGTH))))),
    ).toThrow('too long');
  });
});
