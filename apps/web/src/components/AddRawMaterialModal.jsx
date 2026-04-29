import React from 'react';
import { toast } from 'sonner';
import RawMaterialFormDialog from '@/components/RawMaterialFormDialog.jsx';
import { useRawMaterials } from '@/hooks/useRawMaterials.js';
import { useRawMaterialForm } from '@/hooks/useRawMaterialForm.js';
import { formatName } from '@/utils/formatting.js';

const AddRawMaterialModal = ({ open, onOpenChange, onSuccess }) => {
  const { addMaterial, loading } = useRawMaterials();
  const form = useRawMaterialForm({ open });

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.validateForm()) {
      toast.error('Please fix all errors before submitting');
      return;
    }

    try {
      const result = await addMaterial({
        ...form.buildSubmitPayload(),
        name: formatName(form.formData.name),
      });

      if (result?._creationResolution?.action === 'matched_existing') {
        toast.info(result._creationResolution.message);
      } else {
        toast.success('Material added successfully');
      }

      form.resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(error.message || 'Failed to add material');
    }
  };

  return (
    <RawMaterialFormDialog
      mode="create"
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      form={form}
      onSubmit={handleSubmit}
    />
  );
};

export default AddRawMaterialModal;
