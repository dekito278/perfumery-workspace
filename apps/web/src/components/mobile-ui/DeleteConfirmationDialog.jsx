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
    <AlertDialogContent className="max-w-[340px] rounded-2xl">
      <AlertDialogHeader>
        <AlertDialogTitle>Hapus item ini?</AlertDialogTitle>
        <AlertDialogDescription>
          {itemName ? `"${itemName}" akan dihapus. ` : ''}Tindakan ini tidak bisa dibatalkan.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          disabled={loading}
          data-haptic="warning"
          className="rounded-xl bg-[#ef4444] text-white hover:bg-[#dc2626]"
        >
          {loading ? 'Menghapus...' : 'Hapus'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default DeleteConfirmationDialog;
