import React from 'react';

/**
 * Safely renders plain-text assistant responses into readable paragraphs
 * and bullet lists without allowing HTML or executable markup.
 */
export function StructuredMessageBody({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let currentBullets: string[] = [];

  const flushBullets = (keyPrefix: string) => {
    if (currentBullets.length > 0) {
      blocks.push(
        <ul key={`${keyPrefix}-ul`} className="my-2 list-disc space-y-1.5 pl-5">
          {currentBullets.map((item, i) => (
            <li key={`${keyPrefix}-li-${i}`}>{item}</li>
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
          {rest}
        </p>
      );
    } else {
      blocks.push(
        <p key={`p-${idx}`} className="mt-2 first:mt-0 text-sm leading-relaxed">
          {trimmed}
        </p>
      );
    }
  });

  flushBullets('final');
  return <div>{blocks}</div>;
}
