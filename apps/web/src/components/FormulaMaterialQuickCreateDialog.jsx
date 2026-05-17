import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
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
import { Input } from '@/components/ui/input.jsx';

const FormulaMaterialQuickCreateDialog = ({
  open,
  materialName,
  loading = false,
  onOpenChange,
  onConfirm,
}) => {
  const name = String(materialName || '').trim();
  const [details, setDetails] = useState({
    category: '',
    cas_number: '',
    workbook_code: '',
  });

  useEffect(() => {
    if (open) {
      setDetails({
        category: '',
        cas_number: '',
        workbook_code: '',
      });
    }
  }, [materialName, open]);

  const updateDetail = (field, value) => {
    setDetails((current) => ({ ...current, [field]: value }));
  };

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => {
      if (!loading) onOpenChange?.(nextOpen);
    }}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-[420px] rounded-[26px] border-[#e6deca] bg-[#fffdf8] p-0 shadow-2xl">
        <div className="border-b border-[#efe5d3] bg-[linear-gradient(180deg,#fff8e7_0%,#fffdf8_100%)] px-5 py-4">
          <AlertDialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber-100 text-amber-800">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-700">Quick create</p>
                <AlertDialogTitle className="text-lg font-bold text-[#1f2937]">Tambah raw material baru?</AlertDialogTitle>
              </div>
            </div>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-[#6b7280]">
              Material ini akan dibuat dari input yang kamu ketik, lalu langsung dipilih ke row formula aktif.
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="rounded-2xl border border-[#e6deca] bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a7a5a]">Material name</p>
            <p className="mt-1 break-words text-base font-bold text-[#1f2937]">{name || '-'}</p>
          </div>
          <div className="rounded-2xl border border-[#e6deca] bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a7a5a]">Optional data</p>
                <p className="mt-1 text-xs font-semibold text-[#6b7280]">Isi kalau sudah tahu. Kalau belum, boleh kosong.</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a9099]">Category</span>
                <Input
                  value={details.category}
                  disabled={loading}
                  onChange={(event) => updateDetail('category', event.target.value)}
                  placeholder="ex: Floral"
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a9099]">CAS</span>
                <Input
                  value={details.cas_number}
                  disabled={loading}
                  onChange={(event) => updateDetail('cas_number', event.target.value)}
                  placeholder="optional"
                  className="h-9 rounded-xl text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a9099]">Workbook</span>
                <Input
                  value={details.workbook_code}
                  disabled={loading}
                  onChange={(event) => updateDetail('workbook_code', event.target.value)}
                  placeholder="optional"
                  className="h-9 rounded-xl text-xs"
                />
              </label>
            </div>
          </div>
          <div className="grid gap-2 text-xs font-semibold text-[#4b5563]">
            <div className="flex items-start gap-2 rounded-2xl bg-emerald-50 p-3 text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Dibuat sebagai <strong>raw_material</strong> dengan unit default <strong>g</strong>.</span>
            </div>
            <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Field yang kosong tetap ditandai belum lengkap supaya bisa dilengkapi nanti.</span>
            </div>
          </div>
        </div>

        <AlertDialogFooter className="gap-2 border-t border-[#efe5d3] px-5 py-4 sm:gap-2 sm:space-x-0">
          <AlertDialogCancel disabled={loading} className="mt-0 rounded-2xl bg-white">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={loading || !name}
            className="rounded-2xl bg-[#263d27] text-white hover:bg-[#1d2f1e]"
            onClick={(event) => {
              event.preventDefault();
              onConfirm?.(details);
            }}
          >
            {loading ? 'Membuat...' : 'Tambah & pilih'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default FormulaMaterialQuickCreateDialog;
