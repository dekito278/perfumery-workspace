import React from 'react';
import MobileLoadingState from '@/components/mobile-ui/MobileLoadingState.jsx';

const MobileLoadingSkeleton = ({ title = 'Memuat...', subtitle = 'Menyiapkan ruang kerja Studio.' }) => (
  <MobileLoadingState title={title} subtitle={subtitle} />
);

export default MobileLoadingSkeleton;
