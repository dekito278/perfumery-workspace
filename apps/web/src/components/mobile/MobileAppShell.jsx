import React from 'react';
import MobileBottomNavigation from '@/components/mobile/MobileBottomNavigation.jsx';
import MobileFloatingActionButton from '@/components/mobile/MobileFloatingActionButton.jsx';
import MobileSessionActions from '@/components/mobile/MobileSessionActions.jsx';

const MobileAppShell = ({ children, showFab = true }) => (
  <div className="mobile-app">
    <div className="mobile-app-shell">
      {children}
    </div>
    <MobileSessionActions />
    <MobileBottomNavigation />
    {showFab ? <MobileFloatingActionButton /> : null}
  </div>
);

export default MobileAppShell;
