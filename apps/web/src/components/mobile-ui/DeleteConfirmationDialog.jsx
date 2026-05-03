import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';

const DeleteConfirmationDialog = ({ open, onOpenChange, itemName, onConfirm, loading = false }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="max-w-[340px] rounded-[26px]">
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this item?</AlertDialogTitle>
        <AlertDialogDescription>
          {itemName ? `"${itemName}" will be deleted. ` : ''}This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="rounded-2xl">Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          disabled={loading}
          className="rounded-2xl bg-[#ef4444] text-white hover:bg-[#dc2626]"
        >
          {loading ? 'Deleting...' : 'Delete'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default DeleteConfirmationDialog;
