import React from 'react';

const INLINE_TOKEN_REGEX =
  /(\*\*[^*\n]+\*\*|`[^`\n]+`|https:\/\/[^\s<>()]+[^\s<>().,;!?])/g;

function renderSafeInline(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(INLINE_TOKEN_REGEX);
  if (parts.length === 1) {
    return text;
  }

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${keyPrefix}-b-${idx}`} className="font-semibold text-[#1E2421]">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={`${keyPrefix}-c-${idx}`}
          className="rounded bg-[#ECEAE3] px-1 py-0.5 font-mono text-[0.85em] text-[#1E2421]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('https://')) {
      return (
        <a
          key={`${keyPrefix}-a-${idx}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#2F5D50] underline underline-offset-4 hover:text-[#1F4238] break-all"
        >
          {part}
        </a>
      );
    }

    return part;
  });
}

/**
 * Safely renders structured plain-text / limited-Markdown assistant responses
 * into readable paragraphs and bullet lists without HTML sinks or unsafe links.
 */
export function StructuredMessageBody({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let currentBullets: string[] = [];

  const flushBullets = (keyPrefix: string) => {
    if (currentBullets.length > 0) {
      blocks.push(
        <ul key={`${keyPrefix}-ul`} className="my-2 list-disc space-y-1.5 pl-5 text-sm">
          {currentBullets.map((item, i) => (
            <li key={`${keyPrefix}-li-${i}`}>
              {renderSafeInline(item, `${keyPrefix}-li-${i}`)}
            </li>
          ))}
        </ul>
      );
      currentBullets = [];
    }
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushBullets(`line-${idx}`);
      return;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      currentBullets.push(trimmed.replace(/^[-*•]\s+/, ''));
      return;
    }

    flushBullets(`line-${idx}`);

    // Convert Markdown `# Heading` safely to semantic strong text without raw HTML
    const headingMatch = /^#{1,3}\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      blocks.push(
        <p
          key={`md-h-${idx}`}
          className="mt-3 first:mt-0 text-xs font-semibold tracking-wide text-[#1E2421]"
        >
          {renderSafeInline(headingMatch[1], `md-h-${idx}`)}
        </p>
      );
      return;
    }

    if (/^(next steps|why this may help):$/i.test(trimmed)) {
      blocks.push(
        <p
          key={`heading-${idx}`}
          className="mt-3 text-xs font-semibold tracking-wide text-[#1E2421]"
        >
          {trimmed}
        </p>
      );
    } else if (/^why this may help:/i.test(trimmed)) {
      const rest = trimmed.replace(/^why this may help:\s*/i, '');
      blocks.push(
        <p key={`why-${idx}`} className="mt-3 text-sm leading-relaxed">
          <strong className="font-semibold text-[#1E2421]">Why this may help: </strong>
          {renderSafeInline(rest, `why-${idx}`)}
        </p>
      );
    } else {
      blocks.push(
        <p key={`p-${idx}`} className="mt-2 first:mt-0 text-sm leading-relaxed">
          {renderSafeInline(trimmed, `p-${idx}`)}
        </p>
      );
    }
  });

  flushBullets('final');
  return <div>{blocks}</div>;
}
