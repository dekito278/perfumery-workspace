
import pb from '@/lib/pocketbaseClient.js';

/**
 * VERIFIED POCKETBASE SCHEMA (from database section):
 * 
 * ACCORDS COLLECTION:
 * - id: text (auto-generated, primary key)
 * - name: text (REQUIRED)
 * - notes: text (optional)
 * - stock_quantity: number (REQUIRED, min: 0)
 * - userId: text (REQUIRED)
 * - created_at: autodate
 * - created: autodate
 * - updated: autodate
 * - description: text (optional)
 * - cost_per_unit: number (optional)
 * - unit: text (optional)
 * 
 * ACCORD_ITEMS COLLECTION:
 * - id: text (auto-generated, primary key)
 * - accord_id: relation to accords (REQUIRED)
 * - raw_material_id: relation to raw_materials (REQUIRED)
 * - percentage: number (REQUIRED, min: 0, max: 100)
 * - created: autodate
 * - updated: autodate
 * 
 * NOTE: accord_items does NOT have a 'grams' field - only percentage!
 */

export const getAccords = async () => {
  try {
    const records = await pb.collection('accords').getFullList({
      sort: '-created',
      $autoCancel: false
    });
    return records;
  } catch (error) {
    console.error('Error fetching accords:', error);
    throw new Error('Failed to fetch accords');
  }
};

export const getAccordById = async (id) => {
  try {
    const record = await pb.collection('accords').getOne(id, {
      $autoCancel: false
    });
    return record;
  } catch (error) {
    console.error('Error fetching accord:', error);
    throw new Error('Failed to fetch accord');
  }
};

export const getAccordItems = async (accordId) => {
  try {
    const records = await pb.collection('accord_items').getFullList({
      filter: `accord_id="${accordId}"`,
      expand: 'raw_material_id',
      $autoCancel: false
    });
    return records;
  } catch (error) {
    console.error('Error fetching accord items:', error);
    throw new Error('Failed to fetch accord items');
  }
};

/**
 * Validate accord item before creating
 * @param {Object} item - Item to validate
 * @param {number} index - Item index for error messages
 * @returns {Object} { valid: boolean, error: string }
 */
const validateAccordItem = (item, index) => {
  console.log(`=== VALIDATING ITEM ${index + 1} ===`);
  console.log('Raw item:', JSON.stringify(item, null, 2));
  console.log('Item field types:', {
    raw_material_id: typeof item.raw_material_id,
    percentage: typeof item.percentage,
    raw_material_id_value: item.raw_material_id,
    percentage_value: item.percentage
  });

  // Validate raw_material_id
  if (!item.raw_material_id) {
    return { valid: false, error: 'raw_material_id is missing' };
  }

  if (typeof item.raw_material_id !== 'string') {
    return { valid: false, error: `raw_material_id must be a string, got ${typeof item.raw_material_id}` };
  }

  if (item.raw_material_id.trim() === '') {
    return { valid: false, error: 'raw_material_id is empty' };
  }

  // Validate percentage
  if (item.percentage === undefined || item.percentage === null) {
    return { valid: false, error: 'percentage is missing' };
  }

  const percentageNum = Number(item.percentage);
  if (isNaN(percentageNum)) {
    return { valid: false, error: `percentage must be a number, got ${typeof item.percentage}` };
  }

  if (percentageNum < 0 || percentageNum > 100) {
    return { valid: false, error: `percentage must be between 0-100, got ${percentageNum}` };
  }

  console.log(`✓ Item ${index + 1} validation passed`);
  return { valid: true };
};

export const createAccord = async (accordData, items) => {
  console.log('=== ACCORD CREATION START ===');
  console.log('Checkpoint: createAccord called');
  
  try {
    const userId = pb.authStore.model?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    console.log('Input accordData:', JSON.stringify(accordData, null, 2));
    console.log('Input items:', JSON.stringify(items, null, 2));
    console.log('Current user ID:', userId);

    // STEP 1: Validate all items BEFORE creating accord
    console.log('=== VALIDATING ALL ITEMS ===');
    const validationErrors = [];
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No items provided - accord must have at least one ingredient');
    }

    for (let i = 0; i < items.length; i++) {
      const validation = validateAccordItem(items[i], i);
      if (!validation.valid) {
        validationErrors.push(`Item ${i + 1}: ${validation.error}`);
      }
    }

    if (validationErrors.length > 0) {
      const errorMessage = `Item validation failed:\n${validationErrors.join('\n')}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    console.log('✓ All items validated successfully');

    // STEP 2: Create accord record
    console.log('=== CREATING ACCORD RECORD ===');
    console.log('Checkpoint: Before accord create');
    
    const accordPayload = {
      name: String(accordData.name).trim(),
      stock_quantity: 0, // Default to 0 for new accords
      userId: userId
    };

    // Add optional fields only if provided
    if (accordData.notes) {
      accordPayload.notes = String(accordData.notes).trim();
    }

    if (accordData.description) {
      accordPayload.description = String(accordData.description).trim();
    }

    if (accordData.unit) {
      accordPayload.unit = String(accordData.unit);
    } else {
      accordPayload.unit = 'ml';
    }

    console.log('Accord payload:', JSON.stringify(accordPayload, null, 2));
    console.log('Payload field types:', {
      name: typeof accordPayload.name,
      stock_quantity: typeof accordPayload.stock_quantity,
      userId: typeof accordPayload.userId,
      notes: typeof accordPayload.notes,
      description: typeof accordPayload.description,
      unit: typeof accordPayload.unit
    });

    const accord = await pb.collection('accords').create(accordPayload, { $autoCancel: false });

    console.log('✓ Accord created successfully');
    console.log('Checkpoint: After accord create');
    console.log('Accord response:', {
      id: accord.id,
      name: accord.name,
      stock_quantity: accord.stock_quantity,
      userId: accord.userId
    });

    // Verify accord ID is valid
    if (!accord?.id || typeof accord.id !== 'string' || accord.id.trim() === '') {
      throw new Error('Accord creation failed: no valid ID returned');
    }

    // STEP 3: Create accord_items separately
    console.log('=== CREATING ACCORD ITEMS ===');
    console.log(`Creating ${items.length} accord items for accord ${accord.id}`);

    const failedItems = [];
    const createdItems = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      console.log(`Checkpoint: Before creating item ${i + 1}/${items.length}`);
      
      // Build accord_item payload with explicit type conversion
      const itemPayload = {
        accord_id: String(accord.id),
        raw_material_id: String(item.raw_material_id).trim(),
        percentage: Number(item.percentage)
      };

      console.log(`Item ${i + 1} payload:`, JSON.stringify(itemPayload, null, 2));
      console.log(`Item ${i + 1} field types:`, {
        accord_id: typeof itemPayload.accord_id,
        raw_material_id: typeof itemPayload.raw_material_id,
        percentage: typeof itemPayload.percentage,
        percentage_isNumber: !isNaN(itemPayload.percentage)
      });

      try {
        const createdItem = await pb.collection('accord_items').create(itemPayload, { $autoCancel: false });
        console.log(`✓ Item ${i + 1} created successfully`);
        console.log('Checkpoint: After creating item', i + 1);
        console.log('Created item ID:', createdItem.id);
        createdItems.push(createdItem);
      } catch (itemError) {
        console.error(`✗ Failed to create accord item ${i + 1}`);
        console.error('Item error:', itemError);
        console.error('Item error response:', itemError.response);
        console.error('Item error data:', itemError.data);
        console.error('Item validation errors:', itemError.data?.data);
        
        let itemErrorMessage = `Item ${i + 1}`;
        
        if (itemError.data?.data) {
          const validationErrors = Object.entries(itemError.data.data)
            .map(([field, err]) => {
              const message = err.message || err.code || JSON.stringify(err);
              return `${field}: ${message}`;
            })
            .join(', ');
          itemErrorMessage += `: ${validationErrors}`;
        } else if (itemError.data?.message) {
          itemErrorMessage += `: ${itemError.data.message}`;
        } else if (itemError.message) {
          itemErrorMessage += `: ${itemError.message}`;
        }
        
        failedItems.push({ index: i + 1, error: itemErrorMessage, item: item });
      }
    }

    // STEP 4: Handle partial failures
    if (failedItems.length > 0) {
      console.error('=== SOME ITEMS FAILED ===');
      console.error('Failed items:', failedItems);
      console.error('Created items:', createdItems.length);
      
      // If ALL items failed, delete the accord
      if (failedItems.length === items.length) {
        console.error('All items failed - deleting accord');
        try {
          await pb.collection('accords').delete(accord.id, { $autoCancel: false });
          console.log('Accord deleted due to all items failing');
        } catch (deleteError) {
          console.error('Failed to delete accord:', deleteError);
        }
        
        const errorMessage = `All items failed to create:\n${failedItems.map(f => f.error).join('\n')}`;
        throw new Error(errorMessage);
      }
      
      // Some items succeeded, some failed
      const errorMessage = `Accord created but ${failedItems.length} of ${items.length} items failed:\n${failedItems.map(f => f.error).join('\n')}`;
      console.warn(errorMessage);
      throw new Error(errorMessage);
    }

    console.log('✓ All accord items created successfully');
    console.log('=== ACCORD CREATION COMPLETE ===');
    
    return accord;

  } catch (error) {
    console.error('=== ACCORD CREATION ERROR ===');
    console.error('Checkpoint: Creation failed');
    console.error('Error object:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Error response:', error.response);
    console.error('Error data:', error.data);
    console.error('Error data.data (validation errors):', error.data?.data);

    // Extract and format validation errors from PocketBase response
    let errorMessage = 'Failed to create accord';
    
    if (error.data?.data) {
      console.error('=== VALIDATION ERRORS DETECTED ===');
      const validationErrors = Object.entries(error.data.data)
        .map(([field, err]) => {
          const message = err.message || err.code || JSON.stringify(err);
          console.error(`Field "${field}": ${message}`);
          return `${field}: ${message}`;
        })
        .join(', ');
      errorMessage = `Validation failed: ${validationErrors}`;
    } else if (error.data?.message) {
      errorMessage = `Accord creation failed: ${error.data.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }

    console.error('=== FINAL ERROR MESSAGE ===');
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
};

export const updateAccord = async (accordId, accordData, items) => {
  try {
    console.log('=== ACCORD UPDATE DEBUG ===');
    console.log('Updating accord:', accordId);
    console.log('Input accordData:', JSON.stringify(accordData, null, 2));
    console.log('Input items:', JSON.stringify(items, null, 2));

    // Build payload with ONLY fields that exist in accords collection
    const payload = {
      name: String(accordData.name).trim()
    };

    // Add optional fields only if provided
    if (accordData.notes) {
      payload.notes = String(accordData.notes).trim();
    }

    if (accordData.description) {
      payload.description = String(accordData.description).trim();
    }

    if (accordData.unit) {
      payload.unit = String(accordData.unit);
    }

    console.log('Update payload:', JSON.stringify(payload, null, 2));

    const accord = await pb.collection('accords').update(accordId, payload, { $autoCancel: false });

    console.log('✓ Accord updated successfully');

    // Delete existing accord items
    const existingItems = await pb.collection('accord_items').getFullList({
      filter: `accord_id="${accordId}"`,
      $autoCancel: false
    });

    console.log(`Deleting ${existingItems.length} existing accord items...`);

    for (const item of existingItems) {
      await pb.collection('accord_items').delete(item.id, { $autoCancel: false });
    }

    // Create new accord items
    if (items && Array.isArray(items) && items.length > 0) {
      console.log(`Creating ${items.length} new accord items...`);

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const itemPayload = {
          accord_id: accordId,
          raw_material_id: String(item.raw_material_id),
          percentage: Number(item.percentage)
        };

        await pb.collection('accord_items').create(itemPayload, { $autoCancel: false });
      }

      console.log('✓ All accord items created successfully');
    }

    return accord;
  } catch (error) {
    console.error('=== ACCORD UPDATE ERROR ===');
    console.error('Error:', error);
    console.error('Error data:', error.data);
    console.error('Validation errors:', error.data?.data);

    let errorMessage = 'Failed to update accord';
    
    if (error.data?.data) {
      const validationErrors = Object.entries(error.data.data)
        .map(([field, err]) => {
          const message = err.message || err.code || JSON.stringify(err);
          return `${field}: ${message}`;
        })
        .join(', ');
      errorMessage = `Validation failed: ${validationErrors}`;
    } else if (error.data?.message) {
      errorMessage = error.data.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

export const deleteAccord = async (accordId) => {
  try {
    await pb.collection('accords').delete(accordId, { $autoCancel: false });
  } catch (error) {
    console.error('Error deleting accord:', error);
    throw new Error('Failed to delete accord');
  }
};

export const produceAccord = async (accordId, quantity) => {
  try {
    const accord = await pb.collection('accords').getOne(accordId, { $autoCancel: false });
    
    await pb.collection('accords').update(accordId, {
      stock_quantity: Number(accord.stock_quantity) + Number(quantity)
    }, { $autoCancel: false });

    return { success: true };
  } catch (error) {
    console.error('Error producing accord:', error);
    throw new Error('Failed to produce accord');
  }
};
