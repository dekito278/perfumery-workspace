import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, ChevronRight, FileUp, FlaskConical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';

const actions = [
  { label: 'New Formula', path: '/mobile/formulas/new', icon: FlaskConical },
  { label: 'Batch Calculator', path: '/mobile/batches', icon: Calculator },
  { label: 'Production Costing', path: '/mobile/production-costing', icon: Calculator },
  { label: 'Add Material', path: '/mobile/raw-materials/new', icon: Plus },
  { label: 'Import Formula PDF', path: '/mobile/formulas?action=import', icon: FileUp },
];

const MobileFloatingActionButton = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon"
        onClick={() => setOpen(true)}
        className="mobile-fab mobile-interactive mobile-add-action mobile-pressable h-14 w-14 rounded-full bg-[#f59e0b] text-white shadow-2xl shadow-amber-300/50 hover:bg-[#d97706]"
        aria-label="Open quick actions"
      >
        <Plus className="h-6 w-6" />
      </Button>
      <MobileBottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Quick actions"
      >
        <div className="grid gap-2 pb-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(action.path);
                }}
                className="mobile-card mobile-interactive mobile-pressable flex items-center gap-3 p-3 text-left"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#1f2937]">{action.label}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
              </button>
            );
          })}
        </div>
      </MobileBottomSheet>
    </>
  );
};

export default MobileFloatingActionButton;
