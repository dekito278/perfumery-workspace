import React from 'react';

// Customer briefs arrive as free text from a textarea, often pasted from a chat assistant: several
// paragraphs, "* " bullets, "**bold**" runs. Rendered as a bare {value} the browser collapses every
// newline and the owner gets one 1,500-character line. Keep the structure; nothing more.
const inline = (text) => text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => (
  part.startsWith('**') && part.endsWith('**') && part.length > 4
    ? <strong key={index} className="font-bold text-editorial-charcoal">{part.slice(2, -2)}</strong>
    : part
));

const isBullet = (line) => /^[*•-]\s+/.test(line);

const BriefText = ({ text, className = '' }) => {
  const lines = String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  const blocks = [];
  for (const line of lines) {
    const last = blocks[blocks.length - 1];
    if (isBullet(line)) {
      const item = line.replace(/^[*•-]\s+/, '');
      if (last?.type === 'list') last.items.push(item);
      else blocks.push({ type: 'list', items: [item] });
    } else {
      blocks.push({ type: 'p', text: line });
    }
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {blocks.map((block, index) => (
        block.type === 'list'
          ? (
            <ul key={index} className="list-disc space-y-0.5 pl-4">
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}
            </ul>
          )
          : <p key={index}>{inline(block.text)}</p>
      ))}
    </div>
  );
};

export default BriefText;
