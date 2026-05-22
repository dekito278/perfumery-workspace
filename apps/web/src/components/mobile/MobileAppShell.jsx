import React from 'react';
import MobileBottomNavigation from '@/components/mobile/MobileBottomNavigation.jsx';
import MobileFloatingActionButton from '@/components/mobile/MobileFloatingActionButton.jsx';
import MobileSessionActions from '@/components/mobile/MobileSessionActions.jsx';
import { useMobileKeyboardState } from '@/hooks/useMobileKeyboardState.js';
import { useMobileKeyboardAvoidance } from '@/hooks/useMobileKeyboardAvoidance.js';
import { useMobileFormEnhancements } from '@/hooks/useMobileFormEnhancements.js';
import { useMobileTouchFeedback } from '@/hooks/useMobileTouchFeedback.js';
import { cn } from '@/lib/utils.js';

const MobileAppShell = ({ children, showFab = true, taskMode = false }) => {
  const keyboardActive = useMobileKeyboardState();
  useMobileKeyboardAvoidance();
  useMobileFormEnhancements();
  useMobileTouchFeedback();
  const shouldShowFab = showFab && !taskMode;

  return (
    <div className={cn('mobile-app', keyboardActive && 'mobile-keyboard-active', taskMode && 'mobile-task-mode')} data-mobile-task-mode={taskMode || undefined}>
      <div className="mobile-app-shell" data-mobile-primary-scroller="true">
        {children}
      </div>
      <MobileSessionActions />
      <MobileBottomNavigation />
      {shouldShowFab ? <MobileFloatingActionButton /> : null}
    </div>
  );
};

export default MobileAppShell;
