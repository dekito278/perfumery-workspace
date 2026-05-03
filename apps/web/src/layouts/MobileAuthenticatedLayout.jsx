import React from 'react';
import MobileAppShell from '@/components/mobile/MobileAppShell.jsx';

const MobileAuthenticatedLayout = ({ children, showFab = false }) => (
  <MobileAppShell showFab={showFab}>{children}</MobileAppShell>
);

export default MobileAuthenticatedLayout;
