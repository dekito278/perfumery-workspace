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
      toast.error('Please fix all errors before submitting');
      return;
    }

    try {
      await updateMaterial(material.id, {
        ...form.buildSubmitPayload(),
        name: formatName(form.formData.name),
      });

      toast.success('Material updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || 'Failed to update material');
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
