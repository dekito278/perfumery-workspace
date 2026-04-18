
import pb from '@/lib/pocketbaseClient.js';

export const getFormulas = async () => {
  try {
    const records = await pb.collection('formulas').getFullList({
      sort: '-created',
      $autoCancel: false
    });
    return records;
  } catch (error) {
    console.error('Error fetching formulas:', error);
    throw new Error('Failed to fetch formulas');
  }
};

export const getFormulaById = async (id) => {
  try {
    const record = await pb.collection('formulas').getOne(id, {
      $autoCancel: false
    });
    return record;
  } catch (error) {
    console.error('Error fetching formula:', error);
    throw new Error('Failed to fetch formula');
  }
};

export const getFormulaItems = async (formulaId) => {
  try {
    const records = await pb.collection('formula_items').getFullList({
      filter: `formula_id="${formulaId}"`,
      sort: 'created',
      $autoCancel: false
    });
    return records;
  } catch (error) {
    console.error('Error fetching formula items:', error);
    throw new Error('Failed to fetch formula items');
  }
};

export const createFormula = async (formulaData, items) => {
  try {
    const userId = pb.authStore.model?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    console.log('=== FORMULA CREATION DEBUG ===');
    console.log('Input formulaData:', formulaData);
    console.log('Input items:', items);

    // Step 1: Create formula record
    const formulaPayload = {
      name: String(formulaData.name).trim(),
      code: String(formulaData.code || `FORMULA-${Date.now()}`).trim(),
      userId: userId
    };

    // Add optional fields only if provided
    if (formulaData.notes) {
      formulaPayload.notes = String(formulaData.notes).trim();
    }

    if (formulaData.category) {
      formulaPayload.category = String(formulaData.category);
    }

    if (formulaData.status) {
      formulaPayload.status = String(formulaData.status);
    } else {
      formulaPayload.status = 'draft';
    }

    if (formulaData.version !== undefined && formulaData.version !== null && formulaData.version !== '') {
      formulaPayload.version = Number(formulaData.version);
    }

    if (formulaData.batch_size !== undefined && formulaData.batch_size !== null) {
      formulaPayload.batch_size = Number(formulaData.batch_size);
    }

    if (formulaData.batch_date) {
      formulaPayload.batch_date = formulaData.batch_date;
    }

    if (formulaData.markup_percentage !== undefined && formulaData.markup_percentage !== null) {
      formulaPayload.markup_percentage = Number(formulaData.markup_percentage);
    } else {
      formulaPayload.markup_percentage = 0;
    }

    console.log('Formula payload being sent:', JSON.stringify(formulaPayload, null, 2));

    const formula = await pb.collection('formulas').create(formulaPayload, { $autoCancel: false });

    console.log('Formula created successfully:', formula);

    // Step 2: Create formula_items separately
    if (items && Array.isArray(items) && items.length > 0) {
      console.log(`Creating ${items.length} formula items...`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const itemPayload = {
          formula_id: formula.id,
          item_type: item.item_type || 'raw_material',
          item_id: String(item.item_id),
          percentage: Number(item.percentage)
        };

        // Add optional fields
        if (item.grams !== undefined && item.grams !== null) {
          itemPayload.grams = Number(item.grams);
        }

        if (item.dilution_percent !== undefined && item.dilution_percent !== null) {
          itemPayload.dilution_percent = Number(item.dilution_percent);
        }

        if (item.concentrate_amount !== undefined && item.concentrate_amount !== null) {
          itemPayload.concentrate_amount = Number(item.concentrate_amount);
        }

        console.log(`Creating formula item ${i + 1}/${items.length}:`, itemPayload);

        try {
          await pb.collection('formula_items').create(itemPayload, { $autoCancel: false });
          console.log(`Formula item ${i + 1} created successfully`);
        } catch (itemError) {
          console.error(`Failed to create formula item ${i + 1}:`, itemError);
          console.error('Item error data:', itemError.data);
          
          let itemErrorMessage = `Failed to create formula item ${i + 1}`;
          if (itemError.data?.data) {
            const validationErrors = Object.entries(itemError.data.data)
              .map(([field, err]) => `${field}: ${err.message || err.code}`)
              .join(', ');
            itemErrorMessage = `Formula item ${i + 1} validation failed: ${validationErrors}`;
          }
          
          throw new Error(itemErrorMessage);
        }
      }

      console.log('All formula items created successfully');
    }

    // Step 3: Return created formula
    return formula;
  } catch (error) {
    console.error('=== FORMULA CREATION ERROR ===');
    console.error('Error object:', error);
    console.error('Error message:', error.message);
    console.error('Error response:', error.response);
    console.error('Error data:', error.data);

    // Extract validation errors from PocketBase response
    let errorMessage = 'Failed to create formula';
    
    if (error.data?.data) {
      console.error('Validation errors:', error.data.data);
      const validationErrors = Object.entries(error.data.data)
        .map(([field, err]) => `${field}: ${err.message || err.code}`)
        .join(', ');
      errorMessage = `Formula creation failed: ${validationErrors}`;
    } else if (error.data?.message) {
      errorMessage = `Formula creation failed: ${error.data.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }

    console.error('Final error message:', errorMessage);
    throw new Error(errorMessage);
  }
};

export const updateFormula = async (formulaId, formulaData, items) => {
  try {
    console.log('=== FORMULA UPDATE DEBUG ===');
    console.log('Updating formula:', formulaId);
    console.log('Input formulaData:', formulaData);
    console.log('Input items:', items);

    // Build payload with ONLY fields that exist in formulas collection
    const payload = {
      name: String(formulaData.name).trim(),
      code: String(formulaData.code).trim()
    };

    // Add optional fields only if provided
    if (formulaData.notes) {
      payload.notes = String(formulaData.notes).trim();
    }

    if (formulaData.category) {
      payload.category = String(formulaData.category);
    }

    if (formulaData.status && ['draft', 'active', 'archived'].includes(formulaData.status)) {
      payload.status = formulaData.status;
    }

    if (formulaData.version !== undefined && formulaData.version !== null && formulaData.version !== '') {
      payload.version = Number(formulaData.version);
    }

    if (formulaData.batch_size !== undefined && formulaData.batch_size !== null) {
      payload.batch_size = Number(formulaData.batch_size);
    }

    if (formulaData.batch_date) {
      payload.batch_date = formulaData.batch_date;
    }

    if (formulaData.markup_percentage !== undefined && formulaData.markup_percentage !== null) {
      payload.markup_percentage = Number(formulaData.markup_percentage);
    }

    console.log('Updating formula with payload:', payload);

    const formula = await pb.collection('formulas').update(formulaId, payload, { $autoCancel: false });

    console.log('Formula updated successfully');

    // Delete existing formula items
    const existingItems = await pb.collection('formula_items').getFullList({
      filter: `formula_id="${formulaId}"`,
      $autoCancel: false
    });

    console.log(`Deleting ${existingItems.length} existing formula items...`);

    for (const item of existingItems) {
      await pb.collection('formula_items').delete(item.id, { $autoCancel: false });
    }

    // Create new formula items
    if (items && Array.isArray(items) && items.length > 0) {
      console.log(`Creating ${items.length} new formula items...`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const itemPayload = {
          formula_id: formulaId,
          item_type: item.item_type || 'raw_material',
          item_id: String(item.item_id),
          percentage: Number(item.percentage)
        };

        if (item.grams !== undefined && item.grams !== null) {
          itemPayload.grams = Number(item.grams);
        }

        if (item.dilution_percent !== undefined && item.dilution_percent !== null) {
          itemPayload.dilution_percent = Number(item.dilution_percent);
        }

        if (item.concentrate_amount !== undefined && item.concentrate_amount !== null) {
          itemPayload.concentrate_amount = Number(item.concentrate_amount);
        }

        await pb.collection('formula_items').create(itemPayload, { $autoCancel: false });
      }

      console.log('All formula items created successfully');
    }

    return formula;
  } catch (error) {
    console.error('=== FORMULA UPDATE ERROR ===');
    console.error('Error:', error);
    console.error('Error data:', error.data);

    let errorMessage = 'Failed to update formula';
    
    if (error.data?.data) {
      const validationErrors = Object.entries(error.data.data)
        .map(([field, err]) => `${field}: ${err.message || err.code}`)
        .join(', ');
      errorMessage = `Formula update failed: ${validationErrors}`;
    } else if (error.data?.message) {
      errorMessage = error.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

export const deleteFormula = async (formulaId) => {
  try {
    await pb.collection('formulas').delete(formulaId, { $autoCancel: false });
  } catch (error) {
    console.error('Error deleting formula:', error);
    throw new Error('Failed to delete formula');
  }
};

export const duplicateFormula = async (formulaId) => {
  try {
    const userId = pb.authStore.model?.id;
    if (!userId) throw new Error('User not authenticated');

    const original = await pb.collection('formulas').getOne(formulaId, { $autoCancel: false });
    const originalItems = await pb.collection('formula_items').getFullList({
      filter: `formula_id="${formulaId}"`,
      $autoCancel: false
    });

    const payload = {
      name: `Copy of ${original.name}`,
      code: `${original.code}-COPY-${Date.now()}`,
      userId: userId,
      markup_percentage: original.markup_percentage || 0
    };

    if (original.notes) payload.notes = original.notes;
    if (original.category) payload.category = original.category;
    if (original.status) payload.status = original.status;
    if (original.version) payload.version = Number(original.version);
    if (original.batch_size) payload.batch_size = Number(original.batch_size);
    if (original.batch_date) payload.batch_date = original.batch_date;

    const duplicate = await pb.collection('formulas').create(payload, { $autoCancel: false });

    for (const item of originalItems) {
      const itemPayload = {
        formula_id: duplicate.id,
        item_type: item.item_type,
        item_id: item.item_id,
        percentage: Number(item.percentage)
      };

      if (item.grams) itemPayload.grams = Number(item.grams);
      if (item.dilution_percent) itemPayload.dilution_percent = Number(item.dilution_percent);
      if (item.concentrate_amount) itemPayload.concentrate_amount = Number(item.concentrate_amount);

      await pb.collection('formula_items').create(itemPayload, { $autoCancel: false });
    }

    return duplicate;
  } catch (error) {
    console.error('Error duplicating formula:', error);
    throw new Error('Failed to duplicate formula');
  }
};
