import React from 'react';
import { SearchX } from 'lucide-react';
import MobileStatePanel from '@/components/mobile-ui/MobileStatePanel.jsx';

const MobileEmptyState = ({ icon = SearchX, title, description, action, onAction, secondaryAction, onSecondaryAction }) => (
  <MobileStatePanel
    tone="empty"
    icon={icon}
    title={title}
    description={description}
    action={action}
    onAction={onAction}
    secondaryAction={secondaryAction}
    onSecondaryAction={onSecondaryAction}
  />
);

export default MobileEmptyState;
