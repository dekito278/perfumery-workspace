import React from 'react';

const normalizeHref = (href) => {
  const value = String(href || '').trim();

  if (/^(https?:|mailto:|\/)/i.test(value)) {
    return value;
  }

  return '#';
};

const renderInline = (text) => {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${token}-${match.index}`;

    if (token.startsWith('**')) {
      parts.push(<strong key={key} className="font-bold text-[#111827]">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith('`')) {
      parts.push(<code key={key} className="rounded-md bg-[#ece8df] px-1.5 py-0.5 text-[0.9em] font-semibold text-[#263d27]">{token.slice(1, -1)}</code>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = normalizeHref(linkMatch?.[2]);
      parts.push(
        <a key={key} href={href} target="_blank" rel="noreferrer" className="font-bold text-[#263d27] underline decoration-[#8d7a4f]/40 underline-offset-4">
          {linkMatch?.[1] || href}
        </a>
      );
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : text;
};

const parseBlocks = (content) => {
  const lines = String(content || '').split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];
  let orderedList = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', text: paragraph.join('\n').trim() });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list.length) {
      blocks.push({ type: 'list', items: list });
      list = [];
    }

    if (orderedList.length) {
      blocks.push({ type: 'ordered-list', items: orderedList });
      orderedList = [];
    }
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedListMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
    const quoteMatch = trimmed.match(/^>\s+(.+)$/);
    const dividerMatch = trimmed.match(/^---+$/);

    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: `h${headingMatch[1].length}`, text: headingMatch[2] });
      return;
    }

    if (listMatch) {
      flushParagraph();
      if (orderedList.length) {
        blocks.push({ type: 'ordered-list', items: orderedList });
        orderedList = [];
      }
      list.push(listMatch[1]);
      return;
    }

    if (orderedListMatch) {
      flushParagraph();
      if (list.length) {
        blocks.push({ type: 'list', items: list });
        list = [];
      }
      orderedList.push(orderedListMatch[1]);
      return;
    }

    if (quoteMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'quote', text: quoteMatch[1] });
      return;
    }

    if (dividerMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'divider' });
      return;
    }

    flushList();
    paragraph.push(line);
  });

  flushParagraph();
  flushList();

  return blocks;
};

const JournalMarkdownContent = ({ content, mobile = false }) => {
  const blocks = parseBlocks(content);

  if (!blocks.length) {
    return null;
  }

  return (
    <div className={mobile ? 'max-w-full space-y-5 break-words text-[16px] font-medium leading-8 text-[#1f2937]' : 'mx-auto w-full max-w-3xl space-y-7 break-words text-[1.075rem] leading-9 text-[#1f2937]'}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}-${block.text || block.items?.[0] || ''}`;

        if (block.type === 'h1') {
          return <h2 key={key} className={mobile ? 'pt-4 text-[22px] font-bold leading-tight text-[#111827]' : 'pt-8 text-3xl font-bold leading-tight text-[#111827]'}>{renderInline(block.text)}</h2>;
        }

        if (block.type === 'h2') {
          return <h3 key={key} className={mobile ? 'pt-3 text-[19px] font-bold leading-tight text-[#111827]' : 'pt-6 text-2xl font-bold leading-tight text-[#111827]'}>{renderInline(block.text)}</h3>;
        }

        if (block.type === 'h3') {
          return <h4 key={key} className={mobile ? 'pt-2 text-[17px] font-bold leading-snug text-[#111827]' : 'pt-4 text-xl font-bold leading-snug text-[#111827]'}>{renderInline(block.text)}</h4>;
        }

        if (block.type === 'list') {
          return (
            <ul key={key} className={mobile ? 'space-y-2 pl-5' : 'space-y-2 pl-6'}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="list-disc whitespace-pre-line">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'ordered-list') {
          return (
            <ol key={key} className={mobile ? 'space-y-2 pl-5' : 'space-y-2 pl-6'}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="list-decimal whitespace-pre-line pl-1">
                  {renderInline(item)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={key} className="border-l-4 border-amber-300 bg-amber-50/60 px-4 py-3 font-medium italic text-[#374151]">
              {renderInline(block.text)}
            </blockquote>
          );
        }

        if (block.type === 'divider') {
          return <hr key={key} className="border-[#d8d5ca]" />;
        }

        return (
          <p key={key} className="whitespace-pre-line">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
};

export default JournalMarkdownContent;
