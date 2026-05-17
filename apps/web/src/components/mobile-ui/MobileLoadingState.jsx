import React from 'react';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';

const MobileLoadingState = ({
  eyebrow = 'Solivagant',
  title = 'Loading...',
  subtitle = 'Preparing your mobile workspace.',
  className = '',
}) => (
  <div className={`mobile-page mobile-centered-state ${className}`}>
    <MobileStatePanel
      tone="loading"
      className="mobile-loading-state mobile-soft-card mobile-loading-breathe"
      eyebrow={eyebrow}
      title={title}
      description={subtitle}
    />
  </div>
);

export default MobileLoadingState;

