import React from 'react';
import MobileAppShell from '@/components/mobile/MobileAppShell.jsx';

const MobileAuthenticatedLayout = ({ children, showFab = true }) => (
  <MobileAppShell showFab={showFab}>{children}</MobileAppShell>
);

export default MobileAuthenticatedLayout;
