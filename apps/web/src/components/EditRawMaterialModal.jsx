import React from 'react';
import { toast } from 'sonner';
import RawMaterialFormDialog from '@/components/RawMaterialFormDialog.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useRawMaterialForm } from '@/hooks/useRawMaterialForm.js';
import { formatName } from '@/utils/formatting.js';

const EditRawMaterialModal = ({ open, onOpenChange, material, onSuccess }) => {
  const { updateMaterial, loading } = useRawMaterials();
  const form = useRawMaterialForm({ open, material });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!material) {
      return;
    }

    if (!form.validateForm()) {
      toast.error('Perbaiki dulu isian yang masih salah sebelum menyimpan');
      return;
    }

    try {
      await updateMaterial(material.id, {
        ...form.buildSubmitPayload(),
        name: formatName(form.formData.name),
      });

      toast.success('Bahan baku diperbarui');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || 'Gagal menyimpan bahan baku');
    }
  };

  return (
    <RawMaterialFormDialog
      mode="edit"
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      form={form}
      onSubmit={handleSubmit}
    />
  );
};

export default EditRawMaterialModal;
