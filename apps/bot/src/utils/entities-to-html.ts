import type { MessageEntity } from 'telegraf/types';

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttr = (text: string): string => escapeHtml(text).replace(/"/g, '&quot;');

interface EntityTags {
  open: string;
  close: string;
}

/**
 * Map a Telegram message entity to the Telegram-HTML tags that reproduce it.
 * Entity types without a dedicated HTML representation (mention, url, hashtag…)
 * return null — their text is emitted verbatim (escaped).
 */
const tagsFor = (entity: MessageEntity): EntityTags | null => {
  switch (entity.type) {
    case 'bold':
      return { open: '<b>', close: '</b>' };
    case 'italic':
      return { open: '<i>', close: '</i>' };
    case 'underline':
      return { open: '<u>', close: '</u>' };
    case 'strikethrough':
      return { open: '<s>', close: '</s>' };
    case 'spoiler':
      return { open: '<tg-spoiler>', close: '</tg-spoiler>' };
    case 'code':
      return { open: '<code>', close: '</code>' };
    case 'pre':
      return entity.language
        ? { open: `<pre><code class="language-${escapeAttr(entity.language)}">`, close: '</code></pre>' }
        : { open: '<pre>', close: '</pre>' };
    case 'blockquote':
      return { open: '<blockquote>', close: '</blockquote>' };
    case 'text_link':
      return { open: `<a href="${escapeAttr(entity.url)}">`, close: '</a>' };
    case 'custom_emoji':
      return { open: `<tg-emoji emoji-id="${escapeAttr(entity.custom_emoji_id)}">`, close: '</tg-emoji>' };
    default:
      return null;
  }
};

/**
 * Reconstruct a Telegram-HTML string from a message's plain text and entities,
 * ready to be re-sent with `parse_mode: 'HTML'`. Handles premium (custom) emoji
 * plus the standard formatting entities, preserving proper nesting.
 *
 * Entity offsets/lengths are UTF-16 code units, which matches JS string
 * indexing, so plain `slice` is correct here.
 */
export const entitiesToHtml = (text: string, entities?: MessageEntity[]): string => {
  if (!entities?.length) {
    return escapeHtml(text);
  }

  const rendered = entities
    .map((entity) => ({ entity, tags: tagsFor(entity) }))
    .filter((item): item is { entity: MessageEntity; tags: EntityTags } => item.tags !== null);

  const positions = new Set<number>([0, text.length]);
  for (const { entity } of rendered) {
    positions.add(entity.offset);
    positions.add(entity.offset + entity.length);
  }
  const sorted = [...positions].sort((a, b) => a - b);

  let result = '';
  for (let i = 0; i < sorted.length; i += 1) {
    const pos = sorted[i];

    // Closing tags first: inner entities (started later) close before outer.
    const closing = rendered
      .filter(({ entity }) => entity.offset + entity.length === pos)
      .sort((a, b) => b.entity.offset - a.entity.offset);
    for (const { tags } of closing) {
      result += tags.close;
    }

    // Then opening tags: outer entities (longer) open before inner.
    const opening = rendered
      .filter(({ entity }) => entity.offset === pos)
      .sort((a, b) => b.entity.length - a.entity.length);
    for (const { tags } of opening) {
      result += tags.open;
    }

    const next = sorted[i + 1];
    if (next !== undefined) {
      result += escapeHtml(text.slice(pos, next));
    }
  }

  return result;
};
