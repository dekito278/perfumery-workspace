# Formulation Intelligence Revoke Plan

## Target Shift

Webapp ini perlu dipindahkan dari model `inventory + production lab` menjadi `formulation intelligence workspace`.

Engine utama baru:

- brief-driven formulation
- material intelligence library
- accord building
- formula composition
- PACE analysis
- validation logging

Yang dipertahankan sebagai fondasi:

- formula workspace
- workbook guidance link
- simulation panel
- IFRA warning pipeline
- contributor ranking

Yang diturunkan statusnya:

- `impact`
- `life/lifetime`

Keduanya tetap dipakai, tetapi hanya sebagai dua komponen di dalam engine performa yang lebih besar.

## Current Repo Reality

Area yang masih paling kuat mengunci aplikasi ke model lama:

- Routing batch di [App.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/App.jsx)
- Sidebar batch dan production cost di [AppShell.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/AppShell.jsx)
- Formula detail masih memuat create batch, batch preview, dan low-stock warning di [FormulaDetailPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/FormulaDetailPage.jsx)
- Dashboard masih menghitung active batches dan low stock di [DashboardPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/DashboardPage.jsx)
- Material library masih berbentuk inventory di [RawMaterialsPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/RawMaterialsPage.jsx)
- Payload material masih mewajibkan field stok di [rawMaterialsService.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/services/rawMaterialsService.js)
- Stock deduction dan usage tracking masih hidup di [batchesSupabaseService.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/services/batchesSupabaseService.js)
- Schema awal masih menanam stok di [20260419023000_raw_materials_and_categories.sql](/C:/webapp/dekito-workspace-perfumery/supabase/migrations/20260419023000_raw_materials_and_categories.sql)
- Schema batch dan usage record masih aktif di [20260419034500_accords_formulas_batches.sql](/C:/webapp/dekito-workspace-perfumery/supabase/migrations/20260419034500_accords_formulas_batches.sql)

Fondasi yang sudah paling dekat ke arah baru:

- [FormulaWorkbookSimulationPanel.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/FormulaWorkbookSimulationPanel.jsx)
- [formulaWorkbookSimulation.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/utils/formulaWorkbookSimulation.js)

## Immediate Revoke Scope

### 1. Remove batch layer completely

Cabut seluruh flow berikut:

- route `/batches`
- page list batch
- batch detail
- create batch modal
- edit batch modal
- batch completion
- stock deduction
- usage records
- formula relation check berbasis batch
- tab atau preview related batches di formula detail

File yang terdampak langsung:

- [App.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/App.jsx)
- [AppShell.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/AppShell.jsx)
- [FormulaDetailPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/FormulaDetailPage.jsx)
- [BatchesPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/BatchesPage.jsx)
- [BatchDetailPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/BatchDetailPage.jsx)
- [CreateBatchModal.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/CreateBatchModal.jsx)
- [EditBatchModal.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/EditBatchModal.jsx)
- [BatchProductionForm.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/BatchProductionForm.jsx)
- [BatchStatusBadge.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/BatchStatusBadge.jsx)
- [useBatches.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/hooks/useBatches.js)
- [batchesSupabaseService.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/services/batchesSupabaseService.js)
- [calculateBatchStockDeduction.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/utils/calculateBatchStockDeduction.js)
- [checkFormulaRelations.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/utils/checkFormulaRelations.js)
- [checkFormulaUsage.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/utils/checkFormulaUsage.js)

### 2. Remove inventory health model

Raw materials harus berubah menjadi `material intelligence library`, bukan item stok gudang.

Hapus dari UX dan payload:

- `stock_quantity`
- `minimum_stock`
- `low_stock_threshold`
- low stock badge/filter
- inventory value
- reorder semantics
- usage history berbasis batch
- kewajiban isi stok saat create/import

File yang terdampak langsung:

- [RawMaterialsPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/RawMaterialsPage.jsx)
- [RawMaterialDetailPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/RawMaterialDetailPage.jsx)
- [RawMaterialDetailModal.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/RawMaterialDetailModal.jsx)
- [RawMaterialsTable.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/RawMaterialsTable.jsx)
- [AddRawMaterialModal.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/AddRawMaterialModal.jsx)
- [EditRawMaterialModal.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/EditRawMaterialModal.jsx)
- [ImportFormulaPdfModal.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/ImportFormulaPdfModal.jsx)
- [rawMaterialsService.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/services/rawMaterialsService.js)
- [accordsSupabaseService.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/services/accordsSupabaseService.js)

### 3. Replace operational dashboard

Dashboard lama harus dihapus total karena saat ini masih memosisikan produk sebagai lab operasi.

Ganti dengan formula analytics dashboard:

- formulas in progress
- accord coverage
- missing guidance
- warning count
- evaluation backlog
- recently revised formulas

File utama:

- [DashboardPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/DashboardPage.jsx)

### 4. Demote production costing

[ProductionCostPage.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/pages/ProductionCostPage.jsx) masih kuat ke model bulk production.

Pilihan aman fase awal:

- hilangkan dari navigasi utama
- jangan dijadikan deadlock untuk revoke utama
- arsipkan sebagai legacy workspace
- rename di fase lanjut menjadi `Formula Economics` jika memang masih dibutuhkan

## Recommended New Flow

Urutan flow yang lebih cocok dengan arah produk:

1. Brief
2. Material shortlist
3. Accord builder
4. Formula composer
5. PACE analysis
6. Validation log

Output PACE minimum:

- opening
- heart
- drydown
- diffusion
- tenacity
- harmony
- smoothness
- bridge quality
- overload warning
- conflict warning

Validation log minimum:

- blotter test
- skin test
- stability note
- revision history
- evaluator note

## Database Decommission Plan

### Decommission now

Hapus atau deprecate:

- table `batches`
- table `batch_usage_records`
- column `raw_materials.stock_quantity`
- column `raw_materials.minimum_stock`
- column `raw_materials.low_stock_threshold`
- logic `is_stock_deducted`
- seed assumption yang memberi default stock

### Keep, but reinterpret

- `raw_materials`
  Jadikan material library.
- `formulas`
  Tetap jadi formula object utama.
- `formula_items`
  Tetap jadi komposisi formula.

### Add gradually

Nama tabel ini bisa dipakai sebagai target desain, tidak harus langsung diwujudkan semua dalam satu migration:

- `material_metrics`
- `material_roles`
- `accords`
- `accord_materials`
- `formula_materials`
- `formula_evaluations`
- `formula_warnings`
- `formula_alternatives`
- `validation_logs`

## Frontend Execution Order

### Phase 1. Soft-remove old UI

Tujuan:
memutus akses user ke model lama tanpa langsung mematahkan semua service internal.

Checklist:

- remove menu `Batches`
- remove route `/batches`
- remove route `/batches/:id`
- remove production-cost from primary nav
- remove batch widgets from dashboard
- remove low-stock widgets from dashboard
- remove create-batch CTA from formula detail
- remove related batch section from formula detail
- rename `Raw materials` language menjadi `Materials` atau `Material Library`

Expected outcome:

- user sudah tidak lagi masuk ke flow batch/stock
- code batch lama masih ada sementara tetapi tidak lagi jadi jalur utama

### Phase 2. Service and hook cleanup

Tujuan:
menghapus coupling logika lama dari application layer.

Checklist:

- delete `useBatches`
- delete batch services
- delete deduction helper
- delete formula relation checks yang hanya relevan karena batch
- hapus query/filter stock dari material service
- ubah create/update material payload supaya tidak lagi kirim field stok
- ubah import PDF material draft supaya tidak lagi memunculkan stock requirements

Expected outcome:

- state management sudah tidak lagi mengenal batch
- material layer mulai bersih sebagai intelligence library

### Phase 3. Supabase migration

Tujuan:
membersihkan schema agar tidak terus menarik frontend kembali ke paradigma lama.

Checklist:

- create migration drop `batch_usage_records`
- create migration drop `batches`
- create migration drop `raw_materials.stock_quantity`
- create migration drop `raw_materials.minimum_stock`
- create migration drop `raw_materials.low_stock_threshold`
- remove constraints/indexes/policies yang hanya relevan untuk batch
- audit seed migration yang masih mengasumsikan stock default

Expected outcome:

- schema tidak lagi memaksa inventory semantics

### Phase 4. Upgrade workbook simulation into PACE analyzer

Tujuan:
memindahkan engine dari `impact/life only` ke performa yang lebih lengkap.

Reuse dari engine sekarang:

- guidance coverage
- IFRA advisory
- top/middle/base balance
- contributor ranking
- linked-profile vs fallback guidance

Perlu ditambahkan:

- accord role scoring
- bridge quality scoring
- overload/conflict detection
- diffusion proxy
- tenacity proxy
- harmony / smoothness heuristics
- warning normalization
- structured output untuk formula detail dan future dashboard

Target file awal:

- [FormulaWorkbookSimulationPanel.jsx](/C:/webapp/dekito-workspace-perfumery/apps/web/src/components/FormulaWorkbookSimulationPanel.jsx)
- [formulaWorkbookSimulation.js](/C:/webapp/dekito-workspace-perfumery/apps/web/src/utils/formulaWorkbookSimulation.js)

### Phase 5. Build new screens

Bangun setelah revoke lama stabil:

- `BriefPage`
- `AccordsPage`
- `AccordDetailPage`
- `ValidationLogPage`
- `FormulaEvaluationPanel`

## Safe Sequencing Notes

Hal yang perlu dijaga selama revoke:

- Jangan mulai dari `CreateFormulaPage.jsx` dan `EditFormulaPage.jsx` dulu.
  Kedua file ini sedang punya perubahan lokal di worktree, jadi revoke awal sebaiknya lewat route, dashboard, sidebar, material library, service, dan migration terlebih dahulu.
- Jangan buang `FormulaWorkbookSimulationPanel` dan `formulaWorkbookSimulation.js`.
  Keduanya justru kandidat engine inti untuk PACE.
- Jangan migrasikan schema lebih dulu sebelum UI batch/stock diputus.
  Kalau database dibersihkan dulu, frontend saat ini akan error di banyak tempat.

## First Implementation Slice

Kalau mau dieksekusi mulai sekarang, irisan paling aman adalah:

1. cabut route dan menu batch
2. cabut batch section dari formula detail
3. cabut low-stock dan batch widgets dari dashboard
4. sembunyikan production cost dari nav
5. ubah vocabulary `Raw materials` menjadi `Materials`

Slice ini paling kecil, paling aman, dan paling cepat mengubah arah produk secara terasa tanpa langsung bentrok ke migrasi database.

## Definition of Done for Revoke Stage 1

Stage 1 dianggap selesai jika:

- user tidak bisa lagi membuka batch flow dari UI utama
- dashboard tidak lagi menyebut batch atau low stock
- formula detail fokus ke composition and analysis, bukan production
- material pages tidak lagi menonjolkan inventory language
- production cost tidak lagi tampil sebagai area inti aplikasi

Setelah itu baru masuk ke cleanup service dan migration schema.
