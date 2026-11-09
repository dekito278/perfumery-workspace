import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormulas } from '@/hooks/useFormulas.js';

const DeleteFormulaModal = ({ isOpen, onClose, formulaId, formulaName, onDeleteSuccess }) => {
  const { deleteFormula } = useFormulas();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteFormula(formulaId);
      toast.success('Formula dihapus');
      onDeleteSuccess();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Gagal menghapus formula. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="w-5 h-5 text-destructive" />
            Hapus formula
          </DialogTitle>
          <DialogDescription className="text-sm">
            {formulaName
              ? `Formula: ${formulaName}`
              : 'Formula yang dipilih akan dihapus permanen.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <p className="text-muted-foreground text-sm">
            Tindakan ini tidak bisa dibatalkan. Hapus formula hanya jika komposisi, panduan workbook, dan catatan performanya sudah tidak dibutuhkan.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button onClick={onClose} variant="outline" disabled={loading} size="sm">
            Batal
          </Button>
          <Button onClick={handleDelete} variant="destructive" disabled={loading} size="sm">
            {loading ? 'Menghapus...' : 'Hapus'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteFormulaModal;
