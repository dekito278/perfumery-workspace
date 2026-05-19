import React from 'react';

const parseBlocks = (content) => {
  const lines = String(content || '').split(/\r?\n/);
  const blocks = [];
  let paragraph = [];
  let list = [];

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
    const quoteMatch = trimmed.match(/^>\s+(.+)$/);

    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: `h${headingMatch[1].length}`, text: headingMatch[2] });
      return;
    }

    if (listMatch) {
      flushParagraph();
      list.push(listMatch[1]);
      return;
    }

    if (quoteMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'quote', text: quoteMatch[1] });
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
    <div className={mobile ? 'space-y-5 text-[16px] font-medium leading-8 text-[#1f2937]' : 'mx-auto max-w-3xl space-y-6 text-[1.05rem] leading-8 text-[#1f2937]'}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}-${block.text || block.items?.[0] || ''}`;

        if (block.type === 'h1') {
          return <h2 key={key} className={mobile ? 'pt-2 text-[22px] font-bold leading-tight text-[#111827]' : 'pt-3 text-3xl font-bold leading-tight text-[#111827]'}>{block.text}</h2>;
        }

        if (block.type === 'h2') {
          return <h3 key={key} className={mobile ? 'pt-2 text-[19px] font-bold leading-tight text-[#111827]' : 'pt-2 text-2xl font-bold leading-tight text-[#111827]'}>{block.text}</h3>;
        }

        if (block.type === 'h3') {
          return <h4 key={key} className={mobile ? 'pt-1 text-[17px] font-bold leading-snug text-[#111827]' : 'pt-1 text-xl font-bold leading-snug text-[#111827]'}>{block.text}</h4>;
        }

        if (block.type === 'list') {
          return (
            <ul key={key} className={mobile ? 'space-y-2 pl-5' : 'space-y-2 pl-6'}>
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`} className="list-disc whitespace-pre-line">
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote key={key} className="border-l-4 border-amber-300 bg-amber-50/60 px-4 py-3 font-medium italic text-[#374151]">
              {block.text}
            </blockquote>
          );
        }

        return (
          <p key={key} className="whitespace-pre-line">
            {block.text}
          </p>
        );
      })}
    </div>
  );
};

export default JournalMarkdownContent;
