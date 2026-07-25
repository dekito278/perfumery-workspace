import React from 'react';

const TextReveal = ({ text, as: Tag = 'h2', className = '' }) => {
  const words = text.split(' ');
  return (
    <Tag className={className} data-text-reveal>
      {words.map((word, i) => (
        <span className="text-reveal-word" key={i}>
          <span>{word}</span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
};

export default TextReveal;
