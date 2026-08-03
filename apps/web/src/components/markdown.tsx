import type { ReactNode } from 'react';

/**
 * Minimal Markdown renderer for help-center content.
 *
 * Renders to React elements rather than an HTML string, so there is no
 * `dangerouslySetInnerHTML` anywhere in the content path and stored XSS is
 * structurally impossible — React escapes every text node. That property is
 * worth more here than full CommonMark support, since the supported subset
 * (headings, paragraphs, lists, tables, inline emphasis, links, code) covers
 * everything the knowledge base actually uses.
 *
 * Links are restricted to http(s) and site-relative targets, so a `javascript:`
 * URL cannot be smuggled in through an edited article.
 */

export function Markdown({ source }: { source: string }) {
  return <div className="space-y-4">{renderBlocks(source)}</div>;
}

function renderBlocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;
  let key = 0;

  while (index < lines.length) {
    const line = lines[index] ?? '';

    if (line.trim() === '') {
      index++;
      continue;
    }

    // Headings
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 2;
      const text = heading[2] ?? '';
      const className =
        level === 2
          ? 'mt-8 text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50'
          : 'mt-6 text-base font-semibold text-neutral-900 dark:text-neutral-100';
      blocks.push(
        level === 2 ? (
          <h2 key={key++} className={className}>
            {renderInline(text)}
          </h2>
        ) : (
          <h3 key={key++} className={className}>
            {renderInline(text)}
          </h3>
        ),
      );
      index++;
      continue;
    }

    // Table: a header row followed by a separator row of dashes.
    if (line.trim().startsWith('|') && (lines[index + 1] ?? '').includes('---')) {
      const header = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? '').trim().startsWith('|')) {
        rows.push(splitRow(lines[index] ?? ''));
        index++;
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                {header.map((cell, i) => (
                  <th key={i} scope="col" className="py-2 pr-4 text-left font-semibold">
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-b border-neutral-200 dark:border-neutral-800">
                  {row.map((cell, c) => (
                    <td key={c} className="py-2 pr-4 text-neutral-700 dark:text-neutral-300">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^[-*]\s+/, ''));
        index++;
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-1.5 pl-5 text-neutral-700 dark:text-neutral-300">
          {items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index] ?? '')) {
        items.push((lines[index] ?? '').replace(/^\d+\.\s+/, ''));
        index++;
      }
      blocks.push(
        <ol key={key++} className="list-decimal space-y-1.5 pl-5 text-neutral-700 dark:text-neutral-300">
          {items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {renderInline(item)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph: consume until a blank line or the start of another block.
    const paragraph: string[] = [];
    while (
      index < lines.length &&
      (lines[index] ?? '').trim() !== '' &&
      !/^(#{2,4}\s|[-*]\s|\d+\.\s|\|)/.test(lines[index] ?? '')
    ) {
      paragraph.push(lines[index] ?? '');
      index++;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed text-neutral-700 dark:text-neutral-300">
        {renderInline(paragraph.join(' '))}
      </p>,
    );
  }

  return blocks;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

/** Handles `**bold**`, `` `code` ``, and `[label](href)`. */
function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern).filter((p) => p !== undefined && p !== '');

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-neutral-900 dark:text-neutral-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="rounded bg-neutral-100 px-1 py-0.5 text-[0.9em] dark:bg-neutral-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const label = link[1] ?? '';
      const href = link[2] ?? '';
      // Anything that is not clearly http(s) or site-relative renders as plain
      // text — this is the guard against `javascript:` and `data:` URLs.
      const safe = /^https?:\/\//i.test(href) || href.startsWith('/');
      if (!safe) return <span key={i}>{label}</span>;
      return (
        <a
          key={i}
          href={href}
          className="font-medium text-accent-700 underline underline-offset-2 dark:text-accent-300"
          {...(href.startsWith('http') ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
        >
          {label}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
