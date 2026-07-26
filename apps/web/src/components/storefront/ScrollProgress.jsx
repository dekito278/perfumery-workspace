import React from 'react';
import { useScrollProgress } from '@/hooks/useParallax.js';

const ScrollProgress = () => {
  const barRef = useScrollProgress();
  return (
    <div className="scroll-progress" aria-hidden="true">
      <div className="scroll-progress__bar" ref={barRef} />
    </div>
  );
};

export default ScrollProgress;
