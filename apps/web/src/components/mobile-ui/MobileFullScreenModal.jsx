import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

const MobileFullScreenModal = ({ open, title, children, footer, onClose }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] mobile-fullscreen-modal">
      <div className="mobile-page-wide flex h-full flex-col">
        <header className="mb-4 flex items-center gap-3">
          <div className="min-w-0 flex-1 text-xl font-bold">{title}</div>
          <Button type="button" variant="outline" size="icon" onClick={onClose} className="rounded-2xl bg-white">
            <X className="h-5 w-5" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto pb-4">{children}</div>
        {footer ? <div className="pt-3">{footer}</div> : null}
      </div>
    </div>
  );
};

export default MobileFullScreenModal;
