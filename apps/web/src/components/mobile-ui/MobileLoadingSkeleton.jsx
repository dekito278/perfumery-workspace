import React from 'react';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';

const MobileLoadingSkeleton = ({ title = 'Loading...', subtitle = 'Preparing your mobile workspace.' }) => (
  <MobileLoadingState title={title} subtitle={subtitle} />
);

export default MobileLoadingSkeleton;
