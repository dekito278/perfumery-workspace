import React from 'react';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.jsx';

const MobileBottomSheet = ({ open, onOpenChange, title, description, children, footer }) => (
  <Drawer open={open} onOpenChange={onOpenChange}>
    <DrawerContent className="mobile-bottom-sheet-content border-[#e5e7eb]">
      <DrawerHeader className="text-left">
        <DrawerTitle className="text-xl">{title}</DrawerTitle>
        {description ? <DrawerDescription>{description}</DrawerDescription> : null}
      </DrawerHeader>
      <div className="overflow-y-auto px-4 pb-4">{children}</div>
      {footer ? <div className="border-t border-[#e5e7eb] bg-white p-4">{footer}</div> : null}
    </DrawerContent>
  </Drawer>
);

export default MobileBottomSheet;
