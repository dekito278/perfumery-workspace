import React from 'react';
import MobileBottomNavigation from '@/components/mobile/MobileBottomNavigation.jsx';
import MobileFloatingActionButton from '@/components/mobile/MobileFloatingActionButton.jsx';
import MobileSessionActions from '@/components/mobile/MobileSessionActions.jsx';
import { useMobileKeyboardState } from '@/hooks/useMobileKeyboardState.js';
import { cn } from '@/lib/utils.js';

const MobileAppShell = ({ children, showFab = true }) => {
  const keyboardActive = useMobileKeyboardState();

  return (
    <div className={cn('mobile-app', keyboardActive && 'mobile-keyboard-active')}>
      <div className="mobile-app-shell">
        {children}
      </div>
      <MobileSessionActions />
      <MobileBottomNavigation />
      {showFab ? <MobileFloatingActionButton /> : null}
    </div>
  );
};

export default MobileAppShell;
