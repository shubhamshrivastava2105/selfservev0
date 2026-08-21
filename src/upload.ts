import type { IndexedDocument } from './types';

/** Characters to a page. A rough count, but a consistent one. */
const CHARS_PER_PAGE = 2600;

/**
 * Characters of each page kept for quoting. Enough for the answer to pick the
 * sentence that matches the question, short enough that a long document still
 * fits in the storage a browser gives us.
 */
const QUOTABLE_CHARS = 1400;

/** Bytes to a page, for a file whose text this prototype cannot reach. */
const BYTES_PER_PAGE = 2400;

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'always', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'cannot', 'could', 'does', 'doing', 'during', 'each', 'from', 'further',
  'have', 'having', 'here', 'into', 'itself', 'more', 'most', 'must', 'other', 'over', 'same',
  'shall', 'should', 'some', 'such', 'than', 'that', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'those', 'through', 'under', 'until', 'very', 'were', 'what', 'when', 'where',
  'which', 'while', 'will', 'with', 'would', 'your',
]);

/** Extensions whose text a browser can read without a parser. */
const READABLE = /\.(txt|md|markdown|csv|tsv|json|log|html?|xml|yaml|yml)$/i;

export function canReadText(name: string): boolean {
  return READABLE.test(name);
}

function kindFor(name: string): IndexedDocument['kind'] {
  const n = name.toLowerCase();
  if (/contract|agreement|msa|sow|order/.test(n)) return 'Contract';
  if (/polic|sop|standard|control/.test(n)) return 'Policy';
  if (/handbook|manual|guide|onboard/.test(n)) return 'Handbook';
  return 'Report';
}

/**
 * The words that make a chunk findable.
 *
 * Retrieval matches a question against a passage's topics, so these have to come
 * out of the text itself: the most frequent words the chunk does not share with
 * every other page.
 */
function topicsFor(text: string): string[] {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []) {
    if (STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    // Deep enough that a clause mentioned once — a termination or a cap — is
    // still findable, not just the words the whole page repeats.
    .slice(0, 14)
    .map(([word]) => word);
}

/**
 * Plain prose from a marked-up file.
 *
 * Headings matter twice over: their numbering ("## 7.") reads as a sentence end
 * and cuts a clause in half, and the hashes end up inside the quote. So a
 * heading becomes a short sentence of its own, which is what it is.
 */
function normalize(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => {
      const heading = /^\s*#{1,6}\s+/.test(line);
      let text = line
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*[-*+]\s+/, '')
        .replace(/^\s*>\s?/, '')
        .trim();
      // Section numbers belong to the heading, not to the sentence after it.
      if (heading) text = text.replace(/^\d+[.)]\s*/, '');
      if (heading && text !== '' && !/[.!?:]$/.test(text)) text += '.';
      return text;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** One page's worth of prose, cut at a sentence where there is one nearby. */
function pageAt(text: string, start: number): { text: string; end: number } {
  const hard = Math.min(start + CHARS_PER_PAGE, text.length);
  if (hard === text.length) return { text: text.slice(start), end: hard };
  const window = text.slice(start, hard + 400);
  const breakAt = window.lastIndexOf('. ');
  const end = breakAt > CHARS_PER_PAGE * 0.5 ? start + breakAt + 1 : hard;
  return { text: text.slice(start, end), end };
}

/**
 * A file the user picked, as something Neo can answer from.
 *
 * Where the browser can read the text, the pages and passages are the real
 * thing and a question genuinely retrieves against them. Where it cannot — a
 * PDF, a Word file — the document is still held and counted, and says plainly
 * that its contents were not read, rather than inventing passages to quote.
 */
export async function documentFromFile(file: File, now: string): Promise<IndexedDocument> {
  // Keyed on the name alone, so re-uploading an edited file replaces the old
  // copy instead of leaving two documents with one name and different contents.
  const id = `doc-up-${file.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const base: Omit<IndexedDocument, 'pages' | 'passages' | 'contentRead'> = {
    id,
    name: file.name,
    kind: kindFor(file.name),
    indexedAt: now,
    origin: 'Upload',
    sizeBytes: file.size,
  };

  if (!canReadText(file.name)) {
    return {
      ...base,
      pages: Math.max(1, Math.round(file.size / BYTES_PER_PAGE)),
      passages: [],
      contentRead: false,
    };
  }

  const text = normalize(await file.text());
  const passages: IndexedDocument['passages'] = [];
  let cursor = 0;
  let page = 1;
  while (cursor < text.length) {
    const chunk = pageAt(text, cursor);
    // Topics come from the whole chunk; the text kept is what a quote can draw
    // a sentence out of.
    passages.push({
      page,
      topics: topicsFor(chunk.text),
      text:
        chunk.text.slice(0, QUOTABLE_CHARS).trim() +
        (chunk.text.length > QUOTABLE_CHARS ? '…' : ''),
    });
    cursor = chunk.end;
    page += 1;
  }

  return {
    ...base,
    pages: Math.max(1, passages.length),
    passages,
    contentRead: true,
  };
}
