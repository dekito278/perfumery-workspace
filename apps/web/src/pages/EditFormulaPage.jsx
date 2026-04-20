import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.jsx';
import FormulaMetadataDialog from '@/components/FormulaMetadataDialog.jsx';
import FormulaItemTableEditor from '@/components/FormulaItemTableEditor.jsx';
import FormulaOdourDisplayPanel from '@/components/FormulaOdourDisplayPanel.jsx';
import { useFormulas } from '@/hooks/useFormulas.js';
import { useFormulaItems } from '@/hooks/useFormulaItems.js';
import { useIsMobile } from '@/hooks/use-mobile.jsx';
import { calculatePercentages, validateFormulaItems } from '@/utils/formulaCalculations.js';
import { calculateTotalAmount } from '@/utils/calculateTotalAmount.js';
import { validateGramAmount } from '@/utils/validation.js';
import { formatGramAmount } from '@/utils/formatting.js';
import { getRawMaterials } from '@/services/rawMaterialsService.js';
import { ensureReferenceLinksForRawMaterials } from '@/services/materialReferenceService.js';

const createEmptyFormulaItem = () => ({
  item_id: '',
  gram_amount: '',
  dilution_percent: '',
  dilution_solvent_id: '',
  dilution_solvent_name: '',
  item_type: '',
});

const getActiveFormulaItems = (items) =>
  items.filter((item) => item.item_id || item.gram_amount || item.dilution_percent || item.dilution_solvent_id);

const ensureTrailingEmptyItem = (items) => {
  const nextItems = [...getActiveFormulaItems(items)];
  const lastItem = nextItems[nextItems.length - 1];

  if (!lastItem || lastItem.item_id || lastItem.gram_amount || lastItem.dilution_percent || lastItem.dilution_solvent_id) {
    nextItems.push(createEmptyFormulaItem());
  }

  return nextItems;
};
const composerSectionClass = 'rounded-[28px] border border-[#e6deca] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(249,246,239,0.98)_100%)] p-4 shadow-sm sm:p-6';

const EditFormulaPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getFormulaById, updateFormula, loading } = useFormulas();
  const { getFormulaItems } = useFormulaItems();
  const [formula, setFormula] = useState(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('perfume');
  const [version, setVersion] = useState('');
  const [status, setStatus] = useState('draft');
  const [notes, setNotes] = useState('');
  const [formulaItems, setFormulaItems] = useState([createEmptyFormulaItem()]);
  const [legacyAccordItems, setLegacyAccordItems] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [referenceLinksMap, setReferenceLinksMap] = useState(new Map());
  const [loadingData, setLoadingData] = useState(true);
  const [validationErrors, setValidationErrors] = useState({});
  const [focusRowIndex, setFocusRowIndex] = useState(0);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [materialLibraryQuery, setMaterialLibraryQuery] = useState('');
  const [metadataDialogOpen, setMetadataDialogOpen] = useState(false);
  const [mobileComposerTab, setMobileComposerTab] = useState('compose');
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      setLoadingData(true);
      try {
        const [formulaData, materialsData, itemsData] = await Promise.all([
          getFormulaById(id),
          getRawMaterials(),
          getFormulaItems(id),
        ]);

        if (!active) {
          return;
        }

        setFormula(formulaData);
        setRawMaterials(materialsData);

        const hiddenLegacyAccordItems = itemsData.filter((item) => item.item_type === 'accord');
        setLegacyAccordItems(hiddenLegacyAccordItems);

        const formattedItems = itemsData
          .filter((item) => item.item_type !== 'accord')
          .map((item) => ({
            item_type: item.item_type,
            item_id: item.item_id,
            gram_amount: item.grams || (item.percentage || 0).toString(),
            dilution_percent: item.dilution_percent?.toString() || '',
            dilution_solvent_id: item.dilution_solvent_id || '',
            dilution_solvent_name: item.dilution_solvent_id
              ? materialsData.find((material) => material.id === item.dilution_solvent_id)?.name || ''
              : '',
          }));

        setName(formulaData.name || '');
        setCode(formulaData.code || '');
        setCategory(formulaData.category || 'perfume');
        setVersion(formulaData.version || '');
        setStatus(formulaData.status || 'draft');
        setNotes(formulaData.notes || '');
        setFormulaItems(ensureTrailingEmptyItem(formattedItems));
        setValidationErrors({});
        setFocusRowIndex(0);
        setActiveRowIndex(Math.max(formattedItems.length, 0));
      } catch (error) {
        toast.error('Failed to load formula data');
        navigate('/formulas');
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    };

    loadData();

    return () => {
      active = false;
    };
  }, [getFormulaById, getFormulaItems, id, navigate]);

  const removeFormulaItem = (index) => {
    const remainingItems = formulaItems.filter((_, itemIndex) => itemIndex !== index);
    setFormulaItems(ensureTrailingEmptyItem(remainingItems));
    setActiveRowIndex((current) => {
      if (current === index) {
        return Math.max(ensureTrailingEmptyItem(remainingItems).length - 1, 0);
      }
      return Math.max(0, current > index ? current - 1 : current);
    });
    const nextErrors = { ...validationErrors };
    delete nextErrors[`item_${index}`];
    setValidationErrors(nextErrors);
  };

  const updateItem = (index, itemId) => {
    const updated = [...formulaItems];
    updated[index].item_id = itemId;
    updated[index].item_type = '';

    const material = rawMaterials.find((row) => row.id === itemId);
    if (material) {
      updated[index].item_type = material.type === 'solvent' ? 'solvent' : 'raw_material';
    }

    setFormulaItems(ensureTrailingEmptyItem(updated));
    setActiveRowIndex(index);
  };

  const buildItemWithMaterial = (baseItem, itemId) => {
    const material = rawMaterials.find((row) => row.id === itemId);

    return {
      ...baseItem,
      item_id: itemId,
      item_type: material ? (material.type === 'solvent' ? 'solvent' : 'raw_material') : '',
    };
  };

  const handleLibrarySelect = (itemId) => {
    if (selectedRawMaterialIdsSet.has(itemId)) {
      return;
    }

    updateItem(activeRowIndex, itemId);
  };

  const handleLibraryDoubleClick = (itemId) => {
    const currentRowItemId = formulaItems[activeRowIndex]?.item_id;
    if (selectedRawMaterialIdsSet.has(itemId) && currentRowItemId !== itemId) {
      return;
    }

    setFormulaItems((currentItems) => {
      const nextItems = [...currentItems];
      const rowIndex = Math.min(activeRowIndex, Math.max(nextItems.length - 1, 0));
      nextItems[rowIndex] = buildItemWithMaterial(nextItems[rowIndex] || createEmptyFormulaItem(), itemId);

      const normalizedItems = ensureTrailingEmptyItem(nextItems);
      const nextActiveIndex = Math.max(normalizedItems.length - 1, 0);
      setActiveRowIndex(nextActiveIndex);
      setFocusRowIndex(nextActiveIndex);
      return normalizedItems;
    });
  };

  const handleMobileLibraryPick = (itemId) => {
    handleLibraryDoubleClick(itemId);
    setMobileLibraryOpen(false);
    setMobileComposerTab('compose');
  };

  const updateGramAmount = (index, gramAmount) => {
    const updated = [...formulaItems];
    updated[index].gram_amount = gramAmount;
    setFormulaItems(ensureTrailingEmptyItem(updated));
    setActiveRowIndex(index);

    const error = validateGramAmount(gramAmount);
    const nextErrors = { ...validationErrors };
    if (error) {
      nextErrors[`item_${index}`] = error;
    } else {
      delete nextErrors[`item_${index}`];
    }
    setValidationErrors(nextErrors);
  };

  const updateDilutionConfig = (index, field, value) => {
    const updated = [...formulaItems];

    if (field === 'clear_dilution') {
      updated[index].dilution_percent = '';
      updated[index].dilution_solvent_id = '';
      updated[index].dilution_solvent_name = '';
    } else {
      updated[index][field] = value;
    }

    if (field === 'dilution_solvent_id') {
      const solvent = rawMaterials.find((material) => material.id === value);
      updated[index].dilution_solvent_name = solvent?.name || '';
    }

    if (field === 'dilution_percent' && (value === '' || Number(value) <= 0)) {
      updated[index].dilution_percent = '';
      updated[index].dilution_solvent_id = '';
      updated[index].dilution_solvent_name = '';
    }

    setFormulaItems(ensureTrailingEmptyItem(updated));
    setActiveRowIndex(index);
    const nextErrors = { ...validationErrors };
    delete nextErrors.ingredients;
    delete nextErrors[`item_${index}`];
    setValidationErrors(nextErrors);
  };

  const activeFormulaItems = getActiveFormulaItems(formulaItems);
  const totalGrams = calculateTotalAmount(activeFormulaItems);
  const itemsWithPercentages = totalGrams > 0 ? calculatePercentages(activeFormulaItems, totalGrams) : [];
  const rawMaterialsById = useMemo(
    () => new Map(rawMaterials.map((material) => [material.id, material])),
    [rawMaterials]
  );
  const selectedRawMaterialIdsKey = useMemo(
    () => [...new Set(activeFormulaItems.map((item) => item.item_id).filter(Boolean))].sort().join('|'),
    [activeFormulaItems]
  );
  const selectedRawMaterialIds = useMemo(
    () => (selectedRawMaterialIdsKey ? selectedRawMaterialIdsKey.split('|') : []),
    [selectedRawMaterialIdsKey]
  );
  const selectedRawMaterialIdsSet = useMemo(
    () => new Set(selectedRawMaterialIds),
    [selectedRawMaterialIds]
  );
  const sortedRawMaterials = useMemo(
    () => [...rawMaterials].sort((a, b) => a.name.localeCompare(b.name)),
    [rawMaterials]
  );
  const filteredLibraryMaterials = useMemo(() => {
    const normalizedQuery = materialLibraryQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return sortedRawMaterials;
    }

    return sortedRawMaterials.filter((material) =>
      material.name.toLowerCase().includes(normalizedQuery)
    );
  }, [materialLibraryQuery, sortedRawMaterials]);

  useEffect(() => {
    let active = true;

    const loadReferenceLinks = async () => {
      if (!selectedRawMaterialIds.length) {
        if (active) {
          setReferenceLinksMap(new Map());
        }
        return;
      }

      try {
        const selectedMaterials = selectedRawMaterialIds
          .map((materialId) => rawMaterialsById.get(materialId))
          .filter(Boolean);
        const nextMap = await ensureReferenceLinksForRawMaterials(selectedMaterials);
        if (active) {
          setReferenceLinksMap(nextMap);
        }
      } catch (error) {
        if (active) {
          setReferenceLinksMap(new Map());
        }
      }
    };

    loadReferenceLinks();

    return () => {
      active = false;
    };
  }, [selectedRawMaterialIds, rawMaterialsById]);

  const validateForm = () => {
    const errors = {};

    if (!name.trim()) {
      errors.name = 'Formula name is required';
    }
    if (!code.trim()) {
      errors.code = 'Formula code is required';
    }

    const ingredientErrors = validateFormulaItems(activeFormulaItems);
    if (ingredientErrors.length > 0) {
      errors.ingredients = ingredientErrors.join(', ');
    }

    const materialIds = new Set();
    formulaItems.forEach((item, index) => {
      if (item.item_id && materialIds.has(item.item_id)) {
        errors[`item_${index}`] = 'Duplicate material';
      } else if (item.item_id) {
        materialIds.add(item.item_id);
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix validation errors');
      return;
    }

    try {
      const itemsForSubmit = itemsWithPercentages.map((item) => ({
        item_type: item.item_type,
        item_id: item.item_id,
        percentage: item.percentage,
        grams: parseFloat(item.gram_amount),
        dilution_percent: item.dilution_percent ? parseFloat(item.dilution_percent) : null,
        dilution_solvent_id: item.dilution_solvent_id || null,
        concentrate_amount: item.dilution_percent
          ? Number(((parseFloat(item.gram_amount) * parseFloat(item.dilution_percent)) / 100).toFixed(3))
          : null,
      }));

      await updateFormula(id, {
        name,
        code,
        category,
        version: version || null,
        status,
        notes: notes || null,
        total_amount: totalGrams,
      }, itemsForSubmit);

      toast.success('Formula updated successfully');
      navigate(`/formulas/${id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update formula');
    }
  };

  const hasErrors = Object.keys(validationErrors).length > 0;
  const hasLegacyAccordItems = legacyAccordItems.length > 0;
  const renderMaterialLibraryList = ({ mobile = false } = {}) => (
    <div className={mobile ? 'space-y-2' : 'space-y-1.5'}>
      {filteredLibraryMaterials.map((material) => {
        const currentRowItemId = formulaItems[activeRowIndex]?.item_id;
        const alreadyAdded = selectedRawMaterialIdsSet.has(material.id) && currentRowItemId !== material.id;

        return (
          <button
            key={material.id}
            type="button"
            onClick={() => (mobile ? handleMobileLibraryPick(material.id) : handleLibrarySelect(material.id))}
            onDoubleClick={mobile ? undefined : () => handleLibraryDoubleClick(material.id)}
            disabled={alreadyAdded}
            className={`flex w-full min-w-0 flex-col items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
              alreadyAdded
                ? 'cursor-not-allowed border-[#e7dfcf] bg-[#f3eee4] text-muted-foreground opacity-70'
                : 'border-transparent bg-white hover:border-[#decda6] hover:bg-[#fff9ec]'
            }`}
          >
            <div className="min-w-0 w-full">
              <div className="break-words text-sm font-medium leading-snug">{material.name}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {material.type === 'solvent' ? 'Solvent' : 'Raw material'}
                {material.unit ? ` - ${material.unit}` : ''}
              </div>
            </div>
            <div className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
              alreadyAdded
                ? 'bg-[#e4dccb] text-[#8b7d63]'
                : 'bg-[#f6efe0] text-[#7d6942]'
            }`}>
              {alreadyAdded ? 'Added' : mobile ? 'Tap to add' : `Row ${activeRowIndex + 1}`}
            </div>
          </button>
        );
      })}
      {filteredLibraryMaterials.length === 0 ? (
        <div className="rounded-xl bg-white px-3 py-4 text-sm text-muted-foreground">
          No raw materials found.
        </div>
      ) : null}
    </div>
  );

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>{`${formula?.name || 'Edit Formula'} - Perfumer Studio`}</title>
        <meta
          name="description"
          content="Edit a formula with the same composition workspace used for creating formulas."
        />
      </Helmet>

      <div className="page-container overflow-x-hidden">
        <FormulaMetadataDialog
          open={metadataDialogOpen}
          onOpenChange={setMetadataDialogOpen}
          title="Edit formula"
          description="Perbarui identitas formula tanpa meninggalkan composer."
          name={name}
          code={code}
          category={category}
          version={version}
          status={status}
          notes={notes}
          onNameChange={setName}
          onCodeChange={setCode}
          onCategoryChange={setCategory}
          onVersionChange={setVersion}
          onStatusChange={setStatus}
          onNotesChange={setNotes}
          validationErrors={validationErrors}
          onConfirm={() => setMetadataDialogOpen(false)}
          confirmLabel="Apply changes"
        />

        <div className="mb-4 shrink-0">
          <Button
            variant="ghost"
            onClick={() => navigate(formula ? `/formulas/${id}` : '/formulas')}
            className="gap-2 mb-4 h-9"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to formula
          </Button>
        </div>

        <div className={`mb-3 shrink-0 px-3 py-3 sm:px-4 lg:mb-3 ${composerSectionClass}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Formula Composer
              </div>
              <h1 className="mt-1 text-xl font-bold tracking-[-0.02em] sm:text-2xl">
                {name || formula?.name || 'Edit formula'}
              </h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMetadataDialogOpen(true)}
                className="h-10 w-full rounded-2xl px-4 sm:w-auto"
              >
                Edit formula info
              </Button>
              <Button
                type="submit"
                form="edit-formula-form"
                disabled={loading || hasErrors || activeFormulaItems.length === 0 || hasLegacyAccordItems}
                className="h-10 w-full rounded-2xl gap-2 px-5 sm:w-auto"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Updating...' : 'Update formula'}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 md:hidden">
            <div className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1.5 text-xs font-semibold text-[#26314e]">
              {code || 'Code not set'}
            </div>
            <div className="rounded-full border border-[#ddd3bf] bg-[#fbf8f0] px-3 py-1.5 text-xs font-semibold capitalize text-[#433821]">
              {status}
            </div>
            <div className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1.5 text-xs font-semibold capitalize text-[#31451f]">
              {category}
            </div>
          </div>

          <div className="mt-3 hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-[16px] border border-[#e5dcc7] bg-[linear-gradient(135deg,#fff9ec_0%,#f8f1dc_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b7650]">Name</div>
              <div className="mt-1 text-sm font-semibold text-[#443822]">{name || 'Untitled formula'}</div>
            </div>
            <div className="rounded-[16px] border border-[#d9def0] bg-[linear-gradient(135deg,#f6f8ff_0%,#edf2ff_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#61709a]">Code</div>
              <div className="mt-1 text-sm font-semibold text-[#26314e]">{code || 'Code not set'}</div>
            </div>
            <div className="rounded-[16px] border border-[#dce6d1] bg-[linear-gradient(135deg,#f4f9ee_0%,#edf6e3_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f8454]">Category</div>
              <div className="mt-1 text-sm font-semibold capitalize text-[#31451f]">{category}</div>
            </div>
            <div className="rounded-[16px] border border-[#ead7cf] bg-[linear-gradient(135deg,#fff6f2_0%,#fcedea_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a6d5d]">Version</div>
              <div className="mt-1 text-sm font-semibold text-[#4e2c26]">{version || 'Not set'}</div>
            </div>
            <div className="rounded-[16px] border border-[#ddd3bf] bg-[linear-gradient(135deg,#fbf8f0_0%,#f4ede0_100%)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b6a4a]">Status</div>
              <div className="mt-1 text-sm font-semibold capitalize text-[#433821]">{status}</div>
            </div>
          </div>

          <div className="mt-3 hidden rounded-[16px] border border-[#ddd3bf] bg-white px-4 py-3 md:block">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b6a4a]">Notes</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {notes || 'No notes yet'}
            </div>
          </div>
        </div>

        {loadingData ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.72fr)] 2xl:grid-cols-[minmax(0,1.85fr)_minmax(380px,0.68fr)]">
            <div className="space-y-4">
              <Skeleton className="h-[640px] w-full rounded-[28px]" />
            </div>
            <Skeleton className="h-[640px] w-full rounded-[28px]" />
          </div>
        ) : (
          <>
            {isMobile ? (
              <>
                <form id="edit-formula-form" onSubmit={handleSubmit} className="space-y-4">
                  <Tabs value={mobileComposerTab} onValueChange={setMobileComposerTab} className="space-y-4">
                    <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-[#f3ecdd] p-1">
                      <TabsTrigger value="compose" className="rounded-xl py-2 text-xs">Compose</TabsTrigger>
                      <TabsTrigger value="workbook" className="rounded-xl py-2 text-xs">Workbook</TabsTrigger>
                      <TabsTrigger value="info" className="rounded-xl py-2 text-xs">Info</TabsTrigger>
                    </TabsList>

                    <TabsContent value="compose" className="mt-0">
                      <section className={composerSectionClass}>
                        <h2 className="text-lg font-semibold">Formula ingredients</h2>

                        <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                          <div className="rounded-full border border-[#e5dcc7] bg-[#fcf8ef] px-3 py-1.5 text-xs font-semibold text-[#443822]">
                            Rows {activeFormulaItems.length}
                          </div>
                          <div className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1.5 text-xs font-semibold text-[#31451f]">
                            Workbook linked {referenceLinksMap.size}
                          </div>
                          <div className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1.5 text-xs font-semibold text-[#26314e]">
                            Total {formatGramAmount(totalGrams)}
                          </div>
                        </div>

                        {validationErrors.ingredients ? (
                          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
                            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                            <p className="text-xs text-destructive">{validationErrors.ingredients}</p>
                          </div>
                        ) : null}

                        {hasLegacyAccordItems ? (
                          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                            <p className="text-xs text-amber-800">
                              Formula ini masih punya {legacyAccordItems.length} hidden legacy accord item{legacyAccordItems.length > 1 ? 's' : ''}. Update dibatasi sampai data accord lama dibersihkan.
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-4 flex items-center justify-between gap-3 rounded-[18px] border border-[#ddd3bf] bg-[#fcfaf4] px-4 py-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b6d4f]">
                            Material library
                          </div>
                          <Button type="button" className="rounded-xl" onClick={() => setMobileLibraryOpen(true)}>
                            Add material
                          </Button>
                        </div>

                        <div className="mt-4">
                          <FormulaItemTableEditor
                            items={formulaItems}
                            rawMaterials={rawMaterials}
                            focusRowIndex={focusRowIndex}
                            activeRowIndex={activeRowIndex}
                            onAutoFocusHandled={() => setFocusRowIndex(null)}
                            onActivateRow={setActiveRowIndex}
                            onItemChange={updateItem}
                            onGramAmountChange={updateGramAmount}
                            onDilutionChange={updateDilutionConfig}
                            onRemove={removeFormulaItem}
                            validationErrors={validationErrors}
                          />
                        </div>
                      </section>
                    </TabsContent>

                    <TabsContent value="workbook" className="mt-0">
                      <FormulaOdourDisplayPanel
                        items={itemsWithPercentages}
                        rawMaterialsById={rawMaterialsById}
                        referenceLinksMap={referenceLinksMap}
                        isVisible={mobileComposerTab === 'workbook'}
                      />
                    </TabsContent>

                    <TabsContent value="info" className="mt-0">
                      <section className={composerSectionClass}>
                        <h2 className="text-lg font-semibold">Formula info</h2>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                          <div className="rounded-[16px] border border-[#e5dcc7] bg-[linear-gradient(135deg,#fff9ec_0%,#f8f1dc_100%)] px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b7650]">Name</div>
                            <div className="mt-1 text-sm font-semibold text-[#443822]">{name || 'Untitled formula'}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#d9def0] bg-[linear-gradient(135deg,#f6f8ff_0%,#edf2ff_100%)] px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#61709a]">Code</div>
                            <div className="mt-1 text-sm font-semibold text-[#26314e]">{code || 'Code not set'}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#dce6d1] bg-[linear-gradient(135deg,#f4f9ee_0%,#edf6e3_100%)] px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f8454]">Category</div>
                            <div className="mt-1 text-sm font-semibold capitalize text-[#31451f]">{category}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#ead7cf] bg-[linear-gradient(135deg,#fff6f2_0%,#fcedea_100%)] px-3 py-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a6d5d]">Version</div>
                            <div className="mt-1 text-sm font-semibold text-[#4e2c26]">{version || 'Not set'}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#ddd3bf] bg-[linear-gradient(135deg,#fbf8f0_0%,#f4ede0_100%)] px-3 py-2 sm:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b6a4a]">Status</div>
                            <div className="mt-1 text-sm font-semibold capitalize text-[#433821]">{status}</div>
                          </div>
                          <div className="rounded-[16px] border border-[#ddd3bf] bg-white px-3 py-3 sm:col-span-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7b6a4a]">Notes</div>
                            <div className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                              {notes || 'No notes yet'}
                            </div>
                          </div>
                        </div>
                      </section>
                    </TabsContent>
                  </Tabs>
                </form>

                <Drawer open={mobileLibraryOpen} onOpenChange={setMobileLibraryOpen}>
                  <DrawerContent className="max-h-[85vh] rounded-t-[24px] border-[#ddd3bf] bg-[#fcfaf4]">
                    <DrawerHeader className="text-left">
                      <DrawerTitle>Material library</DrawerTitle>
                      <DrawerDescription>
                        Tap sekali untuk langsung menambahkan material ke formula dan pindah ke row berikutnya.
                      </DrawerDescription>
                    </DrawerHeader>
                    <div className="border-b border-[#e7decb] px-4 pb-3">
                      <Input
                        value={materialLibraryQuery}
                        onChange={(event) => setMaterialLibraryQuery(event.target.value)}
                        placeholder="Find raw material..."
                        className="h-10 rounded-xl border-[#ddd3bf] bg-white text-sm"
                      />
                    </div>
                    <div className="overflow-y-auto px-4 py-4">
                      {renderMaterialLibraryList({ mobile: true })}
                    </div>
                  </DrawerContent>
                </Drawer>

                <div className="sticky bottom-3 z-20 mt-4 md:hidden">
                  <div className="rounded-[22px] border border-[#ddd3bf] bg-white/95 p-2 shadow-lg backdrop-blur">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setMetadataDialogOpen(true);
                          setMobileComposerTab('info');
                        }}
                        className="h-11 rounded-2xl"
                      >
                        Edit info
                      </Button>
                      <Button
                        type="submit"
                        form="edit-formula-form"
                        disabled={loading || hasErrors || activeFormulaItems.length === 0 || hasLegacyAccordItems}
                        className="h-11 rounded-2xl gap-2"
                      >
                        <Save className="h-4 w-4" />
                        {loading ? 'Updating...' : 'Update'}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.72fr)] 2xl:grid-cols-[minmax(0,1.85fr)_minmax(380px,0.68fr)]">
                <form id="edit-formula-form" onSubmit={handleSubmit} className="space-y-4">
                  <section className={composerSectionClass}>
                    <h2 className="text-lg font-semibold">Formula ingredients</h2>

                    <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
                      <div className="rounded-full border border-[#e5dcc7] bg-[#fcf8ef] px-3 py-1.5 text-xs font-semibold text-[#443822]">
                        Rows {activeFormulaItems.length}
                      </div>
                      <div className="rounded-full border border-[#dce6d1] bg-[#f3f8ee] px-3 py-1.5 text-xs font-semibold text-[#31451f]">
                        Workbook linked {referenceLinksMap.size}
                      </div>
                      <div className="rounded-full border border-[#d9def0] bg-[#f3f5fb] px-3 py-1.5 text-xs font-semibold text-[#26314e]">
                        Total {formatGramAmount(totalGrams)}
                      </div>
                    </div>

                    {validationErrors.ingredients ? (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 p-3">
                        <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                        <p className="text-xs text-destructive">{validationErrors.ingredients}</p>
                      </div>
                    ) : null}

                    {hasLegacyAccordItems ? (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                        <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                        <p className="text-xs text-amber-800">
                          Formula ini masih punya {legacyAccordItems.length} hidden legacy accord item{legacyAccordItems.length > 1 ? 's' : ''}. Formula masih bisa dilihat, tetapi update dibatasi sampai data accord lama dibersihkan.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-4 rounded-[18px] border border-[#ddd3bf] bg-[#fcfaf4]">
                      <div className="flex flex-col gap-3 border-b border-[#e7decb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b6d4f]">
                          Material library
                        </div>
                        <div className="w-fit rounded-full border border-[#d9cfbb] bg-white px-3 py-1 text-xs font-semibold text-[#5e5239]">
                          Active row {activeRowIndex + 1}
                        </div>
                      </div>

                      <div className="border-b border-[#e7decb] px-4 py-3">
                        <Input
                          value={materialLibraryQuery}
                          onChange={(event) => setMaterialLibraryQuery(event.target.value)}
                          placeholder="Find raw material..."
                          className="h-9 rounded-xl border-[#ddd3bf] bg-white text-sm"
                        />
                      </div>

                      <div className="max-h-[240px] overflow-y-auto px-3 py-3">
                        {renderMaterialLibraryList()}
                      </div>
                    </div>

                    <div className="mt-4">
                      <FormulaItemTableEditor
                        items={formulaItems}
                        rawMaterials={rawMaterials}
                        focusRowIndex={focusRowIndex}
                        activeRowIndex={activeRowIndex}
                        onAutoFocusHandled={() => setFocusRowIndex(null)}
                        onActivateRow={setActiveRowIndex}
                        onItemChange={updateItem}
                        onGramAmountChange={updateGramAmount}
                        onDilutionChange={updateDilutionConfig}
                        onRemove={removeFormulaItem}
                        validationErrors={validationErrors}
                      />
                    </div>
                  </section>
                </form>

                <FormulaOdourDisplayPanel
                  items={itemsWithPercentages}
                  rawMaterialsById={rawMaterialsById}
                  referenceLinksMap={referenceLinksMap}
                  className="xl:sticky xl:top-24 xl:self-start"
                  isVisible
                />
              </div>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default EditFormulaPage;
