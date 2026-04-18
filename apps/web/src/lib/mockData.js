
// Mock data for Perfumer Studio - replaces PocketBase with local state

export const mockRawMaterials = [
  {
    id: 'rm_001',
    name: 'Bergamot Essential Oil',
    category: 'citrus',
    type: 'material',
    stock_quantity: 245.5,
    unit: 'ml',
    cost_per_unit: 78.50,
    supplier_name: 'Citrus Essence Ltd',
    minimum_stock: 50,
    notes: 'Cold-pressed from Calabrian bergamot, premium grade',
    userId: 'mock-user-123',
    created_at: '2026-01-10T09:00:00Z',
    created: '2026-01-10T09:00:00Z',
    updated: '2026-04-15T14:20:00Z'
  },
  {
    id: 'rm_002',
    name: 'Lemon Essential Oil',
    category: 'citrus',
    type: 'material',
    stock_quantity: 180.0,
    unit: 'ml',
    cost_per_unit: 52.00,
    supplier_name: 'Citrus Essence Ltd',
    minimum_stock: 40,
    notes: 'Sicilian lemon, bright and fresh',
    userId: 'mock-user-123',
    created_at: '2026-01-12T10:30:00Z',
    created: '2026-01-12T10:30:00Z',
    updated: '2026-04-14T11:15:00Z'
  },
  {
    id: 'rm_003',
    name: 'Bulgarian Rose Absolute',
    category: 'floral',
    type: 'material',
    stock_quantity: 85.5,
    unit: 'ml',
    cost_per_unit: 185.00,
    supplier_name: 'Floral Extracts International',
    minimum_stock: 30,
    notes: 'Rosa damascena, harvest 2025, exceptional quality',
    userId: 'mock-user-123',
    created_at: '2026-01-15T08:45:00Z',
    created: '2026-01-15T08:45:00Z',
    updated: '2026-04-16T09:30:00Z'
  },
  {
    id: 'rm_004',
    name: 'Jasmine Sambac Absolute',
    category: 'floral',
    type: 'material',
    stock_quantity: 62.0,
    unit: 'ml',
    cost_per_unit: 165.00,
    supplier_name: 'Floral Extracts International',
    minimum_stock: 25,
    notes: 'Night-blooming jasmine, intense and sweet',
    userId: 'mock-user-123',
    created_at: '2026-01-18T11:20:00Z',
    created: '2026-01-18T11:20:00Z',
    updated: '2026-04-13T15:45:00Z'
  },
  {
    id: 'rm_005',
    name: 'Sandalwood Essential Oil',
    category: 'woody',
    type: 'material',
    stock_quantity: 120.0,
    unit: 'ml',
    cost_per_unit: 142.00,
    supplier_name: 'Exotic Woods Co',
    minimum_stock: 40,
    notes: 'Australian sandalwood, certified organic',
    userId: 'mock-user-123',
    created_at: '2026-01-20T09:15:00Z',
    created: '2026-01-20T09:15:00Z',
    updated: '2026-04-12T10:00:00Z'
  },
  {
    id: 'rm_006',
    name: 'Vetiver Essential Oil',
    category: 'woody',
    type: 'material',
    stock_quantity: 95.0,
    unit: 'ml',
    cost_per_unit: 68.00,
    supplier_name: 'Exotic Woods Co',
    minimum_stock: 35,
    notes: 'Haitian vetiver, earthy and grounding',
    userId: 'mock-user-123',
    created_at: '2026-01-22T13:30:00Z',
    created: '2026-01-22T13:30:00Z',
    updated: '2026-04-11T14:20:00Z'
  },
  {
    id: 'rm_007',
    name: 'Patchouli Essential Oil',
    category: 'woody',
    type: 'material',
    stock_quantity: 150.0,
    unit: 'ml',
    cost_per_unit: 45.00,
    supplier_name: 'Exotic Woods Co',
    minimum_stock: 50,
    notes: 'Indonesian patchouli, rich and deep',
    userId: 'mock-user-123',
    created_at: '2026-01-25T10:00:00Z',
    created: '2026-01-25T10:00:00Z',
    updated: '2026-04-10T11:30:00Z'
  },
  {
    id: 'rm_008',
    name: 'Cedarwood Essential Oil',
    category: 'woody',
    type: 'material',
    stock_quantity: 200.0,
    unit: 'ml',
    cost_per_unit: 38.00,
    supplier_name: 'Exotic Woods Co',
    minimum_stock: 60,
    notes: 'Atlas cedarwood, warm and dry',
    userId: 'mock-user-123',
    created_at: '2026-01-28T14:15:00Z',
    created: '2026-01-28T14:15:00Z',
    updated: '2026-04-09T12:45:00Z'
  },
  {
    id: 'rm_009',
    name: 'Alcohol Denat 96%',
    category: 'solvent',
    type: 'solvent',
    stock_quantity: 4500.0,
    unit: 'ml',
    cost_per_unit: 0.18,
    supplier_name: 'Chemical Supplies Ltd',
    minimum_stock: 2000,
    notes: 'Perfumer grade ethanol for dilution',
    userId: 'mock-user-123',
    created_at: '2026-01-05T07:00:00Z',
    created: '2026-01-05T07:00:00Z',
    updated: '2026-04-16T08:30:00Z'
  },
  {
    id: 'rm_010',
    name: 'Distilled Water',
    category: 'solvent',
    type: 'solvent',
    stock_quantity: 3000.0,
    unit: 'ml',
    cost_per_unit: 0.05,
    supplier_name: 'Chemical Supplies Ltd',
    minimum_stock: 1500,
    notes: 'Triple distilled, pharmaceutical grade',
    userId: 'mock-user-123',
    created_at: '2026-01-06T08:00:00Z',
    created: '2026-01-06T08:00:00Z',
    updated: '2026-04-15T09:00:00Z'
  },
  {
    id: 'rm_011',
    name: 'Propylene Glycol',
    category: 'solvent',
    type: 'solvent',
    stock_quantity: 1200.0,
    unit: 'ml',
    cost_per_unit: 0.12,
    supplier_name: 'Chemical Supplies Ltd',
    minimum_stock: 500,
    notes: 'USP grade, for fragrance stabilization',
    userId: 'mock-user-123',
    created_at: '2026-01-08T09:30:00Z',
    created: '2026-01-08T09:30:00Z',
    updated: '2026-04-14T10:15:00Z'
  },
  {
    id: 'rm_012',
    name: 'Jojoba Oil',
    category: 'solvent',
    type: 'solvent',
    stock_quantity: 800.0,
    unit: 'ml',
    cost_per_unit: 0.35,
    supplier_name: 'Natural Oils Co',
    minimum_stock: 300,
    notes: 'Cold-pressed, golden grade',
    userId: 'mock-user-123',
    created_at: '2026-02-01T11:00:00Z',
    created: '2026-02-01T11:00:00Z',
    updated: '2026-04-13T11:45:00Z'
  },
  {
    id: 'rm_013',
    name: 'White Musk Synthetic',
    category: 'musk',
    type: 'material',
    stock_quantity: 220.0,
    unit: 'ml',
    cost_per_unit: 58.00,
    supplier_name: 'Synthetic Fragrances Inc',
    minimum_stock: 80,
    notes: 'Clean, modern musk base',
    userId: 'mock-user-123',
    created_at: '2026-02-05T10:30:00Z',
    created: '2026-02-05T10:30:00Z',
    updated: '2026-04-12T13:20:00Z'
  },
  {
    id: 'rm_014',
    name: 'Ambroxan',
    category: 'amber',
    type: 'material',
    stock_quantity: 175.0,
    unit: 'ml',
    cost_per_unit: 92.00,
    supplier_name: 'Synthetic Fragrances Inc',
    minimum_stock: 60,
    notes: 'Warm, ambery, marine notes',
    userId: 'mock-user-123',
    created_at: '2026-02-08T12:15:00Z',
    created: '2026-02-08T12:15:00Z',
    updated: '2026-04-11T14:30:00Z'
  },
  {
    id: 'rm_015',
    name: 'Iso E Super',
    category: 'woody',
    type: 'material',
    stock_quantity: 190.0,
    unit: 'ml',
    cost_per_unit: 48.00,
    supplier_name: 'Synthetic Fragrances Inc',
    minimum_stock: 70,
    notes: 'Velvety, woody, skin-like',
    userId: 'mock-user-123',
    created_at: '2026-02-10T13:45:00Z',
    created: '2026-02-10T13:45:00Z',
    updated: '2026-04-10T15:00:00Z'
  },
  {
    id: 'rm_016',
    name: 'Grapefruit Essential Oil',
    category: 'citrus',
    type: 'material',
    stock_quantity: 140.0,
    unit: 'ml',
    cost_per_unit: 62.00,
    supplier_name: 'Citrus Essence Ltd',
    minimum_stock: 45,
    notes: 'Pink grapefruit, fresh and uplifting',
    userId: 'mock-user-123',
    created_at: '2026-02-12T09:00:00Z',
    created: '2026-02-12T09:00:00Z',
    updated: '2026-04-09T10:30:00Z'
  },
  {
    id: 'rm_017',
    name: 'Cinnamon Bark Oil',
    category: 'spicy',
    type: 'material',
    stock_quantity: 75.0,
    unit: 'ml',
    cost_per_unit: 72.00,
    supplier_name: 'Spice Extracts Ltd',
    minimum_stock: 30,
    notes: 'Ceylon cinnamon, warm and sweet',
    userId: 'mock-user-123',
    created_at: '2026-02-15T10:30:00Z',
    created: '2026-02-15T10:30:00Z',
    updated: '2026-04-08T11:15:00Z'
  },
  {
    id: 'rm_018',
    name: 'Clove Bud Oil',
    category: 'spicy',
    type: 'material',
    stock_quantity: 65.0,
    unit: 'ml',
    cost_per_unit: 68.00,
    supplier_name: 'Spice Extracts Ltd',
    minimum_stock: 25,
    notes: 'Madagascar clove, rich and spicy',
    userId: 'mock-user-123',
    created_at: '2026-02-18T11:45:00Z',
    created: '2026-02-18T11:45:00Z',
    updated: '2026-04-07T12:30:00Z'
  },
  {
    id: 'rm_019',
    name: 'Black Pepper Oil',
    category: 'spicy',
    type: 'material',
    stock_quantity: 85.0,
    unit: 'ml',
    cost_per_unit: 55.00,
    supplier_name: 'Spice Extracts Ltd',
    minimum_stock: 35,
    notes: 'Indian black pepper, sharp and aromatic',
    userId: 'mock-user-123',
    created_at: '2026-02-20T13:00:00Z',
    created: '2026-02-20T13:00:00Z',
    updated: '2026-04-06T13:45:00Z'
  },
  {
    id: 'rm_020',
    name: 'Lavender Essential Oil',
    category: 'floral',
    type: 'material',
    stock_quantity: 210.0,
    unit: 'ml',
    cost_per_unit: 48.00,
    supplier_name: 'Provence Botanicals',
    minimum_stock: 70,
    notes: 'French lavender, calming and herbaceous',
    userId: 'mock-user-123',
    created_at: '2026-02-22T14:15:00Z',
    created: '2026-02-22T14:15:00Z',
    updated: '2026-04-05T14:00:00Z'
  },
  {
    id: 'rm_021',
    name: 'Rosemary Essential Oil',
    category: 'green',
    type: 'material',
    stock_quantity: 165.0,
    unit: 'ml',
    cost_per_unit: 42.00,
    supplier_name: 'Provence Botanicals',
    minimum_stock: 55,
    notes: 'Spanish rosemary, fresh and herbaceous',
    userId: 'mock-user-123',
    created_at: '2026-02-25T09:30:00Z',
    created: '2026-02-25T09:30:00Z',
    updated: '2026-04-04T10:15:00Z'
  },
  {
    id: 'rm_022',
    name: 'Peppermint Essential Oil',
    category: 'green',
    type: 'material',
    stock_quantity: 195.0,
    unit: 'ml',
    cost_per_unit: 38.00,
    supplier_name: 'Provence Botanicals',
    minimum_stock: 65,
    notes: 'American peppermint, cool and refreshing',
    userId: 'mock-user-123',
    created_at: '2026-02-28T10:45:00Z',
    created: '2026-02-28T10:45:00Z',
    updated: '2026-04-03T11:30:00Z'
  },
  {
    id: 'rm_023',
    name: 'Ylang Ylang Essential Oil',
    category: 'floral',
    type: 'material',
    stock_quantity: 105.0,
    unit: 'ml',
    cost_per_unit: 88.00,
    supplier_name: 'Tropical Essence Co',
    minimum_stock: 40,
    notes: 'Extra grade, sweet and exotic',
    userId: 'mock-user-123',
    created_at: '2026-03-02T12:00:00Z',
    created: '2026-03-02T12:00:00Z',
    updated: '2026-04-02T12:45:00Z'
  },
  {
    id: 'rm_024',
    name: 'Vanilla Absolute',
    category: 'gourmand',
    type: 'material',
    stock_quantity: 92.0,
    unit: 'ml',
    cost_per_unit: 125.00,
    supplier_name: 'Tropical Essence Co',
    minimum_stock: 35,
    notes: 'Madagascar vanilla, rich and creamy',
    userId: 'mock-user-123',
    created_at: '2026-03-05T13:15:00Z',
    created: '2026-03-05T13:15:00Z',
    updated: '2026-04-01T13:30:00Z'
  },
  {
    id: 'rm_025',
    name: 'Tonka Bean Absolute',
    category: 'gourmand',
    type: 'material',
    stock_quantity: 78.0,
    unit: 'ml',
    cost_per_unit: 98.00,
    supplier_name: 'Tropical Essence Co',
    minimum_stock: 30,
    notes: 'Venezuelan tonka, warm and sweet',
    userId: 'mock-user-123',
    created_at: '2026-03-08T14:30:00Z',
    created: '2026-03-08T14:30:00Z',
    updated: '2026-03-31T14:15:00Z'
  }
];

export const mockAccordItems = [
  // Citrus Accord items
  { id: 'ai_001', accord_id: 'acc_001', raw_material_id: 'rm_001', percentage: 40 },
  { id: 'ai_002', accord_id: 'acc_001', raw_material_id: 'rm_002', percentage: 35 },
  { id: 'ai_003', accord_id: 'acc_001', raw_material_id: 'rm_016', percentage: 25 },
  
  // Floral Accord items
  { id: 'ai_004', accord_id: 'acc_002', raw_material_id: 'rm_003', percentage: 35 },
  { id: 'ai_005', accord_id: 'acc_002', raw_material_id: 'rm_004', percentage: 30 },
  { id: 'ai_006', accord_id: 'acc_002', raw_material_id: 'rm_020', percentage: 20 },
  { id: 'ai_007', accord_id: 'acc_002', raw_material_id: 'rm_023', percentage: 15 },
  
  // Woody Accord items
  { id: 'ai_008', accord_id: 'acc_003', raw_material_id: 'rm_005', percentage: 30 },
  { id: 'ai_009', accord_id: 'acc_003', raw_material_id: 'rm_006', percentage: 25 },
  { id: 'ai_010', accord_id: 'acc_003', raw_material_id: 'rm_007', percentage: 25 },
  { id: 'ai_011', accord_id: 'acc_003', raw_material_id: 'rm_008', percentage: 20 },
  
  // Spicy Accord items
  { id: 'ai_012', accord_id: 'acc_004', raw_material_id: 'rm_017', percentage: 35 },
  { id: 'ai_013', accord_id: 'acc_004', raw_material_id: 'rm_018', percentage: 30 },
  { id: 'ai_014', accord_id: 'acc_004', raw_material_id: 'rm_019', percentage: 25 },
  { id: 'ai_015', accord_id: 'acc_004', raw_material_id: 'rm_007', percentage: 10 },
  
  // Musky Accord items
  { id: 'ai_016', accord_id: 'acc_005', raw_material_id: 'rm_013', percentage: 50 },
  { id: 'ai_017', accord_id: 'acc_005', raw_material_id: 'rm_014', percentage: 30 },
  { id: 'ai_018', accord_id: 'acc_005', raw_material_id: 'rm_015', percentage: 20 },
  
  // Fresh Accord items
  { id: 'ai_019', accord_id: 'acc_006', raw_material_id: 'rm_020', percentage: 30 },
  { id: 'ai_020', accord_id: 'acc_006', raw_material_id: 'rm_021', percentage: 25 },
  { id: 'ai_021', accord_id: 'acc_006', raw_material_id: 'rm_022', percentage: 25 },
  { id: 'ai_022', accord_id: 'acc_006', raw_material_id: 'rm_001', percentage: 20 },
  
  // Oriental Accord items
  { id: 'ai_023', accord_id: 'acc_007', raw_material_id: 'rm_024', percentage: 35 },
  { id: 'ai_024', accord_id: 'acc_007', raw_material_id: 'rm_025', percentage: 25 },
  { id: 'ai_025', accord_id: 'acc_007', raw_material_id: 'rm_014', percentage: 20 },
  { id: 'ai_026', accord_id: 'acc_007', raw_material_id: 'rm_017', percentage: 20 },
  
  // Herbal Accord items
  { id: 'ai_027', accord_id: 'acc_008', raw_material_id: 'rm_021', percentage: 40 },
  { id: 'ai_028', accord_id: 'acc_008', raw_material_id: 'rm_020', percentage: 30 },
  { id: 'ai_029', accord_id: 'acc_008', raw_material_id: 'rm_022', percentage: 30 },
  
  // Gourmand Accord items
  { id: 'ai_030', accord_id: 'acc_009', raw_material_id: 'rm_024', percentage: 40 },
  { id: 'ai_031', accord_id: 'acc_009', raw_material_id: 'rm_025', percentage: 35 },
  { id: 'ai_032', accord_id: 'acc_009', raw_material_id: 'rm_013', percentage: 25 }
];

export const mockAccords = [
  {
    id: 'acc_001',
    name: 'Citrus Accord',
    notes: 'Bright and uplifting blend of bergamot, lemon, and grapefruit',
    stock_quantity: 185.0,
    cost_per_unit: 64.08, // (78.50*0.40 + 52.00*0.35 + 62.00*0.25)
    userId: 'mock-user-123',
    created_at: '2026-03-10T09:00:00Z',
    created: '2026-03-10T09:00:00Z',
    updated: '2026-04-15T10:30:00Z'
  },
  {
    id: 'acc_002',
    name: 'Floral Accord',
    notes: 'Romantic blend of rose, jasmine, lavender, and ylang ylang',
    stock_quantity: 142.0,
    cost_per_unit: 126.45, // (185*0.35 + 165*0.30 + 48*0.20 + 88*0.15)
    userId: 'mock-user-123',
    created_at: '2026-03-12T10:15:00Z',
    created: '2026-03-12T10:15:00Z',
    updated: '2026-04-14T11:45:00Z'
  },
  {
    id: 'acc_003',
    name: 'Woody Accord',
    notes: 'Deep woody foundation with sandalwood, vetiver, patchouli, and cedarwood',
    stock_quantity: 168.0,
    cost_per_unit: 68.20, // (142*0.30 + 68*0.25 + 45*0.25 + 38*0.20)
    userId: 'mock-user-123',
    created_at: '2026-03-14T11:30:00Z',
    created: '2026-03-14T11:30:00Z',
    updated: '2026-04-13T12:00:00Z'
  },
  {
    id: 'acc_004',
    name: 'Spicy Accord',
    notes: 'Warm and aromatic blend of cinnamon, clove, black pepper, and patchouli',
    stock_quantity: 95.0,
    cost_per_unit: 64.65, // (72*0.35 + 68*0.30 + 55*0.25 + 45*0.10)
    userId: 'mock-user-123',
    created_at: '2026-03-16T13:00:00Z',
    created: '2026-03-16T13:00:00Z',
    updated: '2026-04-12T13:30:00Z'
  },
  {
    id: 'acc_005',
    name: 'Musky Accord',
    notes: 'Clean and modern musk blend with ambroxan and Iso E Super',
    stock_quantity: 125.0,
    cost_per_unit: 66.20, // (58*0.50 + 92*0.30 + 48*0.20)
    userId: 'mock-user-123',
    created_at: '2026-03-18T14:15:00Z',
    created: '2026-03-18T14:15:00Z',
    updated: '2026-04-11T14:45:00Z'
  },
  {
    id: 'acc_006',
    name: 'Fresh Accord',
    notes: 'Crisp and invigorating blend of lavender, rosemary, mint, and bergamot',
    stock_quantity: 152.0,
    cost_per_unit: 52.60, // (48*0.30 + 42*0.25 + 38*0.25 + 78.50*0.20)
    userId: 'mock-user-123',
    created_at: '2026-03-20T09:45:00Z',
    created: '2026-03-20T09:45:00Z',
    updated: '2026-04-10T10:15:00Z'
  },
  {
    id: 'acc_007',
    name: 'Oriental Accord',
    notes: 'Rich and exotic blend of vanilla, tonka bean, ambroxan, and cinnamon',
    stock_quantity: 108.0,
    cost_per_unit: 96.15, // (125*0.35 + 98*0.25 + 92*0.20 + 72*0.20)
    userId: 'mock-user-123',
    created_at: '2026-03-22T11:00:00Z',
    created: '2026-03-22T11:00:00Z',
    updated: '2026-04-09T11:30:00Z'
  },
  {
    id: 'acc_008',
    name: 'Herbal Accord',
    notes: 'Fresh and aromatic blend of rosemary, lavender, and peppermint',
    stock_quantity: 135.0,
    cost_per_unit: 42.20, // (42*0.40 + 48*0.30 + 38*0.30)
    userId: 'mock-user-123',
    created_at: '2026-03-24T12:30:00Z',
    created: '2026-03-24T12:30:00Z',
    updated: '2026-04-08T12:45:00Z'
  },
  {
    id: 'acc_009',
    name: 'Gourmand Accord',
    notes: 'Sweet and indulgent blend of vanilla, tonka bean, and white musk',
    stock_quantity: 118.0,
    cost_per_unit: 98.85, // (125*0.40 + 98*0.35 + 58*0.25)
    userId: 'mock-user-123',
    created_at: '2026-03-26T13:45:00Z',
    created: '2026-03-26T13:45:00Z',
    updated: '2026-04-07T14:00:00Z'
  }
];

export const mockFormulaItems = [
  // Midnight Elegance PERF-001 items
  { id: 'fi_001', formula_id: 'form_001', item_type: 'accord', item_id: 'acc_002', percentage: 25 },
  { id: 'fi_002', formula_id: 'form_001', item_type: 'accord', item_id: 'acc_003', percentage: 20 },
  { id: 'fi_003', formula_id: 'form_001', item_type: 'accord', item_id: 'acc_005', percentage: 15 },
  { id: 'fi_004', formula_id: 'form_001', item_type: 'solvent', item_id: 'rm_009', percentage: 40 },
  
  // Summer Breeze PERF-002 items
  { id: 'fi_005', formula_id: 'form_002', item_type: 'accord', item_id: 'acc_001', percentage: 30 },
  { id: 'fi_006', formula_id: 'form_002', item_type: 'accord', item_id: 'acc_006', percentage: 20 },
  { id: 'fi_007', formula_id: 'form_002', item_type: 'raw_material', item_id: 'rm_013', percentage: 10 },
  { id: 'fi_008', formula_id: 'form_002', item_type: 'solvent', item_id: 'rm_009', percentage: 40 },
  
  // Forest Walk PERF-003 items
  { id: 'fi_009', formula_id: 'form_003', item_type: 'accord', item_id: 'acc_003', percentage: 35 },
  { id: 'fi_010', formula_id: 'form_003', item_type: 'accord', item_id: 'acc_008', percentage: 15 },
  { id: 'fi_011', formula_id: 'form_003', item_type: 'raw_material', item_id: 'rm_015', percentage: 10 },
  { id: 'fi_012', formula_id: 'form_003', item_type: 'solvent', item_id: 'rm_009', percentage: 40 },
  
  // Rose Garden PERF-004 items
  { id: 'fi_013', formula_id: 'form_004', item_type: 'accord', item_id: 'acc_002', percentage: 30 },
  { id: 'fi_014', formula_id: 'form_004', item_type: 'accord', item_id: 'acc_001', percentage: 15 },
  { id: 'fi_015', formula_id: 'form_004', item_type: 'raw_material', item_id: 'rm_003', percentage: 10 },
  { id: 'fi_016', formula_id: 'form_004', item_type: 'raw_material', item_id: 'rm_013', percentage: 5 },
  { id: 'fi_017', formula_id: 'form_004', item_type: 'solvent', item_id: 'rm_009', percentage: 40 },
  
  // Spice Market PERF-005 items
  { id: 'fi_018', formula_id: 'form_005', item_type: 'accord', item_id: 'acc_004', percentage: 25 },
  { id: 'fi_019', formula_id: 'form_005', item_type: 'accord', item_id: 'acc_007', percentage: 20 },
  { id: 'fi_020', formula_id: 'form_005', item_type: 'accord', item_id: 'acc_003', percentage: 10 },
  { id: 'fi_021', formula_id: 'form_005', item_type: 'raw_material', item_id: 'rm_014', percentage: 5 },
  { id: 'fi_022', formula_id: 'form_005', item_type: 'solvent', item_id: 'rm_009', percentage: 40 },
  
  // Velvet Dreams PERF-006 items
  { id: 'fi_023', formula_id: 'form_006', item_type: 'accord', item_id: 'acc_009', percentage: 25 },
  { id: 'fi_024', formula_id: 'form_006', item_type: 'accord', item_id: 'acc_002', percentage: 15 },
  { id: 'fi_025', formula_id: 'form_006', item_type: 'raw_material', item_id: 'rm_024', percentage: 10 },
  { id: 'fi_026', formula_id: 'form_006', item_type: 'raw_material', item_id: 'rm_005', percentage: 10 },
  { id: 'fi_027', formula_id: 'form_006', item_type: 'solvent', item_id: 'rm_009', percentage: 40 }
];

export const mockFormulas = [
  {
    id: 'form_001',
    name: 'Midnight Elegance',
    code: 'PERF-001',
    version: 'v2.1',
    notes: 'Sophisticated evening fragrance with floral heart and woody base',
    markup_percentage: 85,
    userId: 'mock-user-123',
    created_at: '2026-03-28T09:00:00Z',
    created: '2026-03-28T09:00:00Z',
    updated: '2026-04-15T14:30:00Z'
  },
  {
    id: 'form_002',
    name: 'Summer Breeze',
    code: 'PERF-002',
    version: 'v1.5',
    notes: 'Light and refreshing citrus eau de toilette perfect for daytime',
    markup_percentage: 72,
    userId: 'mock-user-123',
    created_at: '2026-03-30T10:15:00Z',
    created: '2026-03-30T10:15:00Z',
    updated: '2026-04-14T15:00:00Z'
  },
  {
    id: 'form_003',
    name: 'Forest Walk',
    code: 'PERF-003',
    version: 'v1.0',
    notes: 'Earthy and grounding woody fragrance with herbal top notes',
    markup_percentage: 68,
    userId: 'mock-user-123',
    created_at: '2026-04-01T11:30:00Z',
    created: '2026-04-01T11:30:00Z',
    updated: '2026-04-13T11:45:00Z'
  },
  {
    id: 'form_004',
    name: 'Rose Garden',
    code: 'PERF-004',
    version: 'v3.0',
    notes: 'Romantic floral fragrance centered around Bulgarian rose',
    markup_percentage: 95,
    userId: 'mock-user-123',
    created_at: '2026-04-03T12:45:00Z',
    created: '2026-04-03T12:45:00Z',
    updated: '2026-04-12T13:00:00Z'
  },
  {
    id: 'form_005',
    name: 'Spice Market',
    code: 'PERF-005',
    version: 'v1.8',
    notes: 'Warm and exotic oriental fragrance with rich spices',
    markup_percentage: 78,
    userId: 'mock-user-123',
    created_at: '2026-04-05T14:00:00Z',
    created: '2026-04-05T14:00:00Z',
    updated: '2026-04-11T14:15:00Z'
  },
  {
    id: 'form_006',
    name: 'Velvet Dreams',
    code: 'PERF-006',
    version: 'v2.3',
    notes: 'Luxurious gourmand fragrance with vanilla and sandalwood',
    markup_percentage: 88,
    userId: 'mock-user-123',
    created_at: '2026-04-07T09:30:00Z',
    created: '2026-04-07T09:30:00Z',
    updated: '2026-04-10T10:00:00Z'
  }
];

export const mockBatches = [
  {
    id: 'batch_001',
    batch_code: 'BATCH-20240115-001',
    formula_id: 'form_001',
    target_quantity: 500,
    produced_quantity: 500,
    production_date: '2024-01-15',
    status: 'completed',
    notes: 'First production run of Midnight Elegance, excellent quality',
    unit: 'ml',
    userId: 'mock-user-123',
    created: '2024-01-15T08:00:00Z',
    updated: '2024-01-15T16:30:00Z',
    expand: {
      formula_id: {
        id: 'form_001',
        name: 'Midnight Elegance',
        code: 'PERF-001'
      }
    }
  },
  {
    id: 'batch_002',
    batch_code: 'BATCH-20240116-002',
    formula_id: 'form_002',
    target_quantity: 750,
    produced_quantity: 750,
    production_date: '2024-01-16',
    status: 'completed',
    notes: 'Summer Breeze batch for spring collection',
    unit: 'ml',
    userId: 'mock-user-123',
    created: '2024-01-16T09:00:00Z',
    updated: '2024-01-16T17:00:00Z',
    expand: {
      formula_id: {
        id: 'form_002',
        name: 'Summer Breeze',
        code: 'PERF-002'
      }
    }
  },
  {
    id: 'batch_003',
    batch_code: 'BATCH-20240117-003',
    formula_id: 'form_003',
    target_quantity: 300,
    produced_quantity: 300,
    production_date: '2024-01-17',
    status: 'completed',
    notes: 'Limited edition Forest Walk batch',
    unit: 'ml',
    userId: 'mock-user-123',
    created: '2024-01-17T10:00:00Z',
    updated: '2024-01-17T15:30:00Z',
    expand: {
      formula_id: {
        id: 'form_003',
        name: 'Forest Walk',
        code: 'PERF-003'
      }
    }
  },
  {
    id: 'batch_004',
    batch_code: 'BATCH-20240118-004',
    formula_id: 'form_004',
    target_quantity: 1000,
    produced_quantity: 0,
    production_date: '2024-04-20',
    status: 'draft',
    notes: 'Scheduled production for Rose Garden - awaiting material delivery',
    unit: 'ml',
    userId: 'mock-user-123',
    created: '2024-04-16T11:00:00Z',
    updated: '2024-04-16T11:00:00Z',
    expand: {
      formula_id: {
        id: 'form_004',
        name: 'Rose Garden',
        code: 'PERF-004'
      }
    }
  },
  {
    id: 'batch_005',
    batch_code: 'BATCH-20240119-005',
    formula_id: 'form_005',
    target_quantity: 600,
    produced_quantity: 0,
    production_date: '2024-04-22',
    status: 'draft',
    notes: 'Spice Market batch for autumn collection preview',
    unit: 'ml',
    userId: 'mock-user-123',
    created: '2024-04-17T09:30:00Z',
    updated: '2024-04-17T09:30:00Z',
    expand: {
      formula_id: {
        id: 'form_005',
        name: 'Spice Market',
        code: 'PERF-005'
      }
    }
  },
  {
    id: 'batch_006',
    batch_code: 'BATCH-20240112-006',
    formula_id: 'form_006',
    target_quantity: 450,
    produced_quantity: 450,
    production_date: '2024-01-12',
    status: 'completed',
    notes: 'Velvet Dreams batch - premium quality',
    unit: 'ml',
    userId: 'mock-user-123',
    created: '2024-01-12T08:30:00Z',
    updated: '2024-01-12T16:00:00Z',
    expand: {
      formula_id: {
        id: 'form_006',
        name: 'Velvet Dreams',
        code: 'PERF-006'
      }
    }
  }
];

export const mockStockLogs = [
  {
    id: 'log_001',
    date: '2024-01-15',
    log_type: 'batch production',
    material_id: 'rm_003',
    accord_id: null,
    batch_id: 'batch_001',
    quantity_change: -92.5,
    notes: 'Used Bulgarian Rose in Midnight Elegance batch production',
    userId: 'mock-user-123',
    created: '2024-01-15T16:30:00Z',
    updated: '2024-01-15T16:30:00Z'
  },
  {
    id: 'log_002',
    date: '2024-01-15',
    log_type: 'batch production',
    material_id: 'rm_005',
    accord_id: null,
    batch_id: 'batch_001',
    quantity_change: -68.0,
    notes: 'Used Sandalwood in Midnight Elegance batch production',
    userId: 'mock-user-123',
    created: '2024-01-15T16:30:00Z',
    updated: '2024-01-15T16:30:00Z'
  },
  {
    id: 'log_003',
    date: '2024-01-16',
    log_type: 'batch production',
    material_id: 'rm_001',
    accord_id: null,
    batch_id: 'batch_002',
    quantity_change: -112.5,
    notes: 'Used Bergamot in Summer Breeze batch production',
    userId: 'mock-user-123',
    created: '2024-01-16T17:00:00Z',
    updated: '2024-01-16T17:00:00Z'
  },
  {
    id: 'log_004',
    date: '2024-01-10',
    log_type: 'accord production',
    material_id: 'rm_001',
    accord_id: 'acc_001',
    batch_id: null,
    quantity_change: -48.0,
    notes: 'Produced Citrus Accord - used bergamot',
    userId: 'mock-user-123',
    created: '2024-01-10T14:00:00Z',
    updated: '2024-01-10T14:00:00Z'
  },
  {
    id: 'log_005',
    date: '2024-01-10',
    log_type: 'accord production',
    material_id: null,
    accord_id: 'acc_001',
    batch_id: null,
    quantity_change: 120.0,
    notes: 'Produced 120ml of Citrus Accord',
    userId: 'mock-user-123',
    created: '2024-01-10T14:00:00Z',
    updated: '2024-01-10T14:00:00Z'
  },
  {
    id: 'log_006',
    date: '2024-01-08',
    log_type: 'manual adjustment',
    material_id: 'rm_009',
    accord_id: null,
    batch_id: null,
    quantity_change: 2000.0,
    notes: 'Restocked ethanol solvent - new shipment',
    userId: 'mock-user-123',
    created: '2024-01-08T09:00:00Z',
    updated: '2024-01-08T09:00:00Z'
  },
  {
    id: 'log_007',
    date: '2024-01-12',
    log_type: 'accord production',
    material_id: 'rm_003',
    accord_id: 'acc_002',
    batch_id: null,
    quantity_change: -35.0,
    notes: 'Produced Floral Accord - used rose absolute',
    userId: 'mock-user-123',
    created: '2024-01-12T11:30:00Z',
    updated: '2024-01-12T11:30:00Z'
  },
  {
    id: 'log_008',
    date: '2024-01-12',
    log_type: 'accord production',
    material_id: null,
    accord_id: 'acc_002',
    batch_id: null,
    quantity_change: 100.0,
    notes: 'Produced 100ml of Floral Accord',
    userId: 'mock-user-123',
    created: '2024-01-12T11:30:00Z',
    updated: '2024-01-12T11:30:00Z'
  },
  {
    id: 'log_009',
    date: '2024-01-17',
    log_type: 'batch production',
    material_id: 'rm_007',
    accord_id: null,
    batch_id: 'batch_003',
    quantity_change: -52.5,
    notes: 'Used Patchouli in Forest Walk batch production',
    userId: 'mock-user-123',
    created: '2024-01-17T15:30:00Z',
    updated: '2024-01-17T15:30:00Z'
  },
  {
    id: 'log_010',
    date: '2024-01-05',
    log_type: 'manual adjustment',
    material_id: 'rm_024',
    accord_id: null,
    batch_id: null,
    quantity_change: 50.0,
    notes: 'Received new shipment of Madagascar vanilla',
    userId: 'mock-user-123',
    created: '2024-01-05T10:00:00Z',
    updated: '2024-01-05T10:00:00Z'
  },
  {
    id: 'log_011',
    date: '2024-01-14',
    log_type: 'accord production',
    material_id: 'rm_005',
    accord_id: 'acc_003',
    batch_id: null,
    quantity_change: -42.6,
    notes: 'Produced Woody Accord - used sandalwood',
    userId: 'mock-user-123',
    created: '2024-01-14T13:00:00Z',
    updated: '2024-01-14T13:00:00Z'
  },
  {
    id: 'log_012',
    date: '2024-01-14',
    log_type: 'accord production',
    material_id: null,
    accord_id: 'acc_003',
    batch_id: null,
    quantity_change: 142.0,
    notes: 'Produced 142ml of Woody Accord',
    userId: 'mock-user-123',
    created: '2024-01-14T13:00:00Z',
    updated: '2024-01-14T13:00:00Z'
  },
  {
    id: 'log_013',
    date: '2024-01-12',
    log_type: 'batch production',
    material_id: 'rm_024',
    accord_id: null,
    batch_id: 'batch_006',
    quantity_change: -45.0,
    notes: 'Used Vanilla in Velvet Dreams batch production',
    userId: 'mock-user-123',
    created: '2024-01-12T16:00:00Z',
    updated: '2024-01-12T16:00:00Z'
  },
  {
    id: 'log_014',
    date: '2024-01-03',
    log_type: 'manual adjustment',
    material_id: 'rm_013',
    accord_id: null,
    batch_id: null,
    quantity_change: 100.0,
    notes: 'Restocked white musk synthetic',
    userId: 'mock-user-123',
    created: '2024-01-03T11:00:00Z',
    updated: '2024-01-03T11:00:00Z'
  },
  {
    id: 'log_015',
    date: '2024-01-20',
    log_type: 'accord production',
    material_id: 'rm_017',
    accord_id: 'acc_004',
    batch_id: null,
    quantity_change: -25.2,
    notes: 'Produced Spicy Accord - used cinnamon bark',
    userId: 'mock-user-123',
    created: '2024-01-20T10:30:00Z',
    updated: '2024-01-20T10:30:00Z'
  }
];

// Helper function to generate unique IDs
let idCounter = 1000;
export const generateId = (prefix = 'id') => {
  idCounter++;
  return `${prefix}_${idCounter}`;
};

// Helper function to get current timestamp
export const getCurrentTimestamp = () => new Date().toISOString();
