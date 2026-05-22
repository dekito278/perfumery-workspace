import React from 'react';
import MobileAppShell from '@/components/mobile/MobileAppShell.jsx';

const MobileAuthenticatedLayout = ({ children, showFab = false, taskMode = false }) => (
  <MobileAppShell showFab={showFab} taskMode={taskMode}>{children}</MobileAppShell>
);

export default MobileAuthenticatedLayout;
