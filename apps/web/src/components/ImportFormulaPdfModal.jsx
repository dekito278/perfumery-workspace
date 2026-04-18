import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormulas } from '@/hooks/useFormulas.js';
import FormField from '@/components/FormField.jsx';
import FormNumber from '@/components/FormNumber.jsx';
import FormSelect from '@/components/FormSelect.jsx';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { createRawMaterial, getRawMaterials } from '@/services/rawMaterialsService.js';
import { parsePerfumeWorkbookPdf } from '@/utils/perfumeWorkbookPdfParser.js';
import { formatGramAmount } from '@/utils/formatting.js';
import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { suggestPerfumersWorldCategory } from '@/utils/perfumersWorldCategorySuggestions.js';
import { parseDilutionFromMaterialName } from '@/utils/formulaDilutionParsing.js';

const normalizeLookupValue = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const buildMissingMaterialKey = (item) => `${item.workbookCode}::${normalizeLookupValue(item.pureMaterialName || item.materialName)}`;
const buildMissingSolventKey = (solventName) => `solvent::${normalizeLookupValue(solventName)}`;

const createMissingMaterialDraft = (item) => ({
  name: item.pureMaterialName || item.materialName,
  workbook_code: item.workbookCode,
  category: suggestPerfumersWorldCategory({ workbookCode: item.workbookCode, name: item.materialName }).category?.label.toLowerCase() || '',
  type: 'material',
  stock_quantity: '',
  unit: 'ml',
  cost_per_unit: '',
  minimum_stock: '',
  low_stock_threshold: '',
  vendor: '',
  notes: '',
});

const createMissingSolventDraft = (solventName) => ({
  name: solventName,
  workbook_code: '',
  category: 'z - zolvents',
  type: 'solvent',
  stock_quantity: '',
  unit: 'ml',
  cost_per_unit: '',
  minimum_stock: '',
  low_stock_threshold: '',
  vendor: '',
  notes: '',
});

const buildImportNotes = ({ customNotes, parseResult }) => {
  const metadataLines = [
    'Imported from Perfume Workbook PDF',
    `Source file: ${parseResult.fileName}`,
    parseResult.workbookFormulaCode ? `Workbook code: ${parseResult.workbookFormulaCode}` : null,
    parseResult.workbookSheet ? `Workbook WS: ${parseResult.workbookSheet}` : null,
    parseResult.pricePerGram ? `Workbook price: ${parseResult.pricePerGram}` : null,
    parseResult.rawMaterialSummary ? `Workbook RM: ${parseResult.rawMaterialSummary}` : null,
    parseResult.formulaDate ? `Workbook date: ${parseResult.formulaDate}` : null,
  ].filter(Boolean);

  return [customNotes.trim(), metadataLines.join('\n')].filter(Boolean).join('\n\n');
};

const ImportFormulaPdfModal = ({ open, onOpenChange, onSuccess }) => {
  const { createFormula, loading } = useFormulas();
  const [rawMaterials, setRawMaterials] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [loadingReferenceData, setLoadingReferenceData] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formulaName, setFormulaName] = useState('');
  const [formulaAuthor, setFormulaAuthor] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [missingMaterialDrafts, setMissingMaterialDrafts] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadReferenceData = async () => {
      setLoadingReferenceData(true);
      try {
        const [materialsData, categories] = await Promise.all([
          getRawMaterials(),
          getRawMaterialCategories(),
        ]);

        setRawMaterials(materialsData);
        setCategoryOptions(
          categories.map((category) => ({
            value: category.name.toLowerCase(),
            label: findPerfumersWorldCategoryByValue(category.name)?.description
              ? `${category.name} - ${findPerfumersWorldCategoryByValue(category.name).description}`
              : category.name,
          }))
        );
      } catch (error) {
        toast.error('Failed to load import reference data');
      } finally {
        setLoadingReferenceData(false);
      }
    };

    loadReferenceData();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedFileName('');
      setParseResult(null);
      setParseError('');
      setParsing(false);
      setSubmitting(false);
      setFormulaName('');
      setFormulaAuthor('');
      setInternalCode('');
      setNotes('');
      setMissingMaterialDrafts({});
      setValidationErrors({});
    }
  }, [open]);

  const rawMaterialLookup = useMemo(() => {
    const byWorkbookCode = new Map();
    const byName = new Map();

    rawMaterials.forEach((material) => {
      if (material.workbook_code) {
        byWorkbookCode.set(normalizeLookupValue(material.workbook_code), material);
      }

      byName.set(normalizeLookupValue(material.name), material);
    });

    return { byWorkbookCode, byName };
  }, [rawMaterials]);

  const matchedItems = useMemo(() => {
    if (!parseResult) {
      return [];
    }

    return parseResult.items.map((item) => {
      const dilutionInfo = parseDilutionFromMaterialName(item.materialName);
      const workbookCodeMatch = rawMaterialLookup.byWorkbookCode.get(normalizeLookupValue(item.workbookCode));
      const nameMatch = rawMaterialLookup.byName.get(normalizeLookupValue(dilutionInfo.pureName));
      const solventMatch = dilutionInfo.solventName
        ? rawMaterials.find((material) => material.type === 'solvent' && normalizeLookupValue(material.name) === normalizeLookupValue(dilutionInfo.solventName)) || null
        : null;
      const matchedMaterial = workbookCodeMatch || nameMatch || null;

      return {
        ...item,
        pureMaterialName: dilutionInfo.pureName,
        isDilutedInFormula: dilutionInfo.isDilutedInFormula,
        dilutionPercent: dilutionInfo.dilutionPercent,
        dilutionSolventName: dilutionInfo.solventName,
        matchedMaterial,
        matchedSolvent: solventMatch,
      };
    });
  }, [parseResult, rawMaterialLookup, rawMaterials]);

  const missingMaterialEntries = useMemo(() => {
    const uniqueEntries = new Map();

    matchedItems.forEach((item) => {
      if (item.matchedMaterial) {
        return;
      }

      uniqueEntries.set(buildMissingMaterialKey(item), item);
    });

    return [...uniqueEntries.values()];
  }, [matchedItems]);

  const missingSolventEntries = useMemo(() => {
    const uniqueEntries = new Map();

    matchedItems.forEach((item) => {
      if (!item.isDilutedInFormula || item.matchedSolvent || !item.dilutionSolventName) {
        return;
      }

      uniqueEntries.set(buildMissingSolventKey(item.dilutionSolventName), item.dilutionSolventName);
    });

    return [...uniqueEntries.values()];
  }, [matchedItems]);

  useEffect(() => {
    setMissingMaterialDrafts((currentDrafts) => {
      const nextDrafts = {};

      missingMaterialEntries.forEach((item) => {
        const key = buildMissingMaterialKey(item);
        nextDrafts[key] = currentDrafts[key] || createMissingMaterialDraft(item);
      });

      missingSolventEntries.forEach((solventName) => {
        const key = buildMissingSolventKey(solventName);
        nextDrafts[key] = currentDrafts[key] || createMissingSolventDraft(solventName);
      });

      return nextDrafts;
    });
  }, [missingMaterialEntries, missingSolventEntries]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFileName(file.name);
    setParsing(true);
    setParseError('');
    setParseResult(null);
    setValidationErrors({});

    try {
      const parsedResult = await parsePerfumeWorkbookPdf(file);
      setParseResult(parsedResult);
      setFormulaName(parsedResult.formulaName || file.name.replace(/\.pdf$/i, ''));
      setInternalCode('');
      setFormulaAuthor('');
      setNotes('');
      toast.success(`Parsed ${parsedResult.items.length} formula items from PDF`);
    } catch (error) {
      setParseError(error.message || 'Failed to parse PDF');
      toast.error(error.message || 'Failed to parse PDF');
    } finally {
      setParsing(false);
      event.target.value = '';
    }
  };

  const updateMissingMaterialDraft = (key, field, value) => {
    setMissingMaterialDrafts((currentDrafts) => ({
      ...currentDrafts,
      [key]: {
        ...currentDrafts[key],
        [field]: value,
      },
    }));

    setValidationErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[`${key}.${field}`];
      return nextErrors;
    });
  };

  const validateBeforeSubmit = () => {
    const nextErrors = {};

    if (!formulaName.trim()) {
      nextErrors.formulaName = 'Formula name is required';
    }

    [...missingMaterialEntries, ...missingSolventEntries.map((solventName) => ({ solventName, key: buildMissingSolventKey(solventName) }))].forEach((entry) => {
      const isSolventEntry = Boolean(entry.solventName);
      const key = isSolventEntry ? entry.key : buildMissingMaterialKey(entry);
      const draft = missingMaterialDrafts[key];

      if (!draft?.category) {
        nextErrors[`${key}.category`] = 'Category is required';
      }

      if (draft?.stock_quantity === '' || Number.isNaN(Number(draft.stock_quantity))) {
        nextErrors[`${key}.stock_quantity`] = 'Stock quantity is required';
      }

      if (!draft?.unit) {
        nextErrors[`${key}.unit`] = 'Unit is required';
      }

      if (draft?.minimum_stock === '' || Number.isNaN(Number(draft.minimum_stock))) {
        nextErrors[`${key}.minimum_stock`] = 'Minimum stock is required';
      }
    });

    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!parseResult) {
      toast.error('Please choose a Perfume Workbook PDF first');
      return;
    }

    if (!validateBeforeSubmit()) {
      toast.error('Please complete the missing material details first');
      return;
    }

    setSubmitting(true);

    try {
      const createdMaterials = new Map();
      const createdSolvents = new Map();

      for (const item of missingMaterialEntries) {
        const key = buildMissingMaterialKey(item);
        const draft = missingMaterialDrafts[key];
        const createdMaterial = await createRawMaterial({
          name: draft.name.trim(),
          workbook_code: draft.workbook_code.trim(),
          category: draft.category,
          type: draft.type || 'material',
          stock_quantity: Number(draft.stock_quantity),
          unit: draft.unit,
          cost_per_unit: draft.cost_per_unit === '' ? 0 : Number(draft.cost_per_unit),
          supplier_name: null,
          minimum_stock: Number(draft.minimum_stock),
          low_stock_threshold: draft.low_stock_threshold === '' ? null : Number(draft.low_stock_threshold),
          default_dilution_percent: null,
          vendor: draft.vendor.trim() || null,
          cas_number: null,
          charge_number: null,
          ifra_limit: null,
          pyramid_placement: null,
          notes: draft.notes.trim() || `Imported from ${parseResult.fileName}`,
          is_diluted: false,
          dilution_solvent_id: null,
          dilution_percentage: null,
          scent_family: null,
          note_type: null,
        });

        createdMaterials.set(key, createdMaterial);
      }

      for (const solventName of missingSolventEntries) {
        const key = buildMissingSolventKey(solventName);
        const draft = missingMaterialDrafts[key];
        const createdSolvent = await createRawMaterial({
          name: draft.name.trim(),
          workbook_code: null,
          category: draft.category,
          type: 'solvent',
          stock_quantity: Number(draft.stock_quantity),
          unit: draft.unit,
          cost_per_unit: draft.cost_per_unit === '' ? 0 : Number(draft.cost_per_unit),
          supplier_name: null,
          minimum_stock: Number(draft.minimum_stock),
          low_stock_threshold: draft.low_stock_threshold === '' ? null : Number(draft.low_stock_threshold),
          default_dilution_percent: null,
          vendor: draft.vendor.trim() || null,
          cas_number: null,
          charge_number: null,
          ifra_limit: null,
          pyramid_placement: null,
          notes: draft.notes.trim() || `Imported as solvent from ${parseResult.fileName}`,
          is_diluted: false,
          dilution_solvent_id: null,
          dilution_percentage: null,
          scent_family: null,
          note_type: null,
        });

        createdSolvents.set(key, createdSolvent);
      }

      const itemsForSubmit = matchedItems.map((item, index) => {
        const material = item.matchedMaterial || createdMaterials.get(buildMissingMaterialKey(item));
        const dilutionSolvent = item.isDilutedInFormula
          ? item.matchedSolvent || createdSolvents.get(buildMissingSolventKey(item.dilutionSolventName))
          : null;

        if (!material) {
          throw new Error(`Missing raw material mapping for ${item.materialName}`);
        }

        return {
          item_type: material.type === 'solvent' ? 'solvent' : 'raw_material',
          item_id: material.id,
          grams: item.grams,
          percentage: item.percentage,
          sort_order: index,
          dilution_percent: item.isDilutedInFormula ? item.dilutionPercent : null,
          dilution_solvent_id: dilutionSolvent?.id || null,
          concentrate_amount: item.isDilutedInFormula ? Number(((item.grams * item.dilutionPercent) / 100).toFixed(3)) : null,
        };
      });

      await createFormula(
        {
          name: formulaName.trim(),
          code: internalCode.trim() || undefined,
          author_name: formulaAuthor.trim() || null,
          status: 'draft',
          markup_percentage: 0,
          notes: buildImportNotes({ customNotes: notes, parseResult }),
        },
        itemsForSubmit
      );

      toast.success('Formula imported successfully');
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to import formula');
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = loadingReferenceData || parsing || submitting || loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Import formula from Perfume Workbook PDF</DialogTitle>
          <DialogDescription>
            Upload a workbook PDF, review the parsed formula, then complete any new raw materials before saving it into the system.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-dashed bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileUp className="h-4 w-4" />
              Upload PDF
            </div>
            <Input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              disabled={isBusy}
            />
            {selectedFileName && (
              <p className="text-xs text-muted-foreground">Selected file: {selectedFileName}</p>
            )}
            {parseError && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {parseError}
              </div>
            )}
          </div>

          {parseResult && (
            <>
              <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{matchedItems.length} items parsed</Badge>
                    <Badge variant="outline">{missingMaterialEntries.length} new materials</Badge>
                    <Badge variant="outline">{missingSolventEntries.length} new solvents</Badge>
                    <Badge variant="outline">{matchedItems.length - missingMaterialEntries.length} matched materials</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Formula name"
                      value={formulaName}
                      onChange={(event) => setFormulaName(event.target.value)}
                      error={validationErrors.formulaName}
                      required
                    />
                    <FormField
                      label="By"
                      value={formulaAuthor}
                      onChange={(event) => setFormulaAuthor(event.target.value)}
                      placeholder="e.g. Dekito"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Internal code"
                      value={internalCode}
                      onChange={(event) => setInternalCode(event.target.value)}
                      placeholder="Optional, auto-generated if empty"
                    />
                    <div className="space-y-2 text-sm">
                      <p className="font-medium">Workbook source</p>
                      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                        <p>Formula code: {parseResult.workbookFormulaCode || '-'}</p>
                        <p>WS: {parseResult.workbookSheet || '-'}</p>
                        <p>Price: {parseResult.pricePerGram || '-'}</p>
                        <p>Total: {formatGramAmount(parseResult.totalGrams)}</p>
                        <p>Date: {parseResult.formulaDate || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Import notes</label>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                      placeholder="Optional notes to keep with this imported formula"
                    />
                  </div>
                </div>

                <div className="rounded-xl border p-4 space-y-3">
                  <p className="text-sm font-medium">Import readiness</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{matchedItems.length - missingMaterialEntries.length} materials already exist</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{missingMaterialEntries.length} materials need inventory details</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{missingSolventEntries.length} dilution solvents may need inventory details</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Existing materials are matched by workbook code first, then by raw material name.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-3">
                  <p className="text-sm font-medium">Parsed formula items</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">No</TableHead>
                        <TableHead className="w-28">Workbook code</TableHead>
                        <TableHead>Raw material</TableHead>
                        <TableHead className="text-right w-28">Amount (g)</TableHead>
                        <TableHead className="w-48">Match status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matchedItems.map((item) => (
                        <TableRow key={`${item.lineNumber}-${item.workbookCode}-${item.materialName}`}>
                          <TableCell className="font-mono text-xs">{item.lineNumber}</TableCell>
                          <TableCell className="font-mono text-xs">{item.workbookCode}</TableCell>
                          <TableCell className="text-sm">
                            {item.pureMaterialName}
                            {item.isDilutedInFormula && (
                              <div className="text-xs text-muted-foreground">
                                {item.dilutionPercent}% in {item.dilutionSolventName}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{item.grams.toFixed(4)}</TableCell>
                          <TableCell>
                            {item.matchedMaterial ? (
                              <Badge variant="outline" className="text-xs">
                                Existing: {item.matchedMaterial.name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                New material required
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {(missingMaterialEntries.length > 0 || missingSolventEntries.length > 0) && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">New inventory materials to create</p>
                    <p className="text-xs text-muted-foreground">
                      Fill these fields once. Pure materials and dilution solvents created here will be reused automatically on future imports.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {missingMaterialEntries.map((item) => {
                      const key = buildMissingMaterialKey(item);
                      const draft = missingMaterialDrafts[key] || createMissingMaterialDraft(item);

                      return (
                        <div key={key} className="rounded-xl border p-4 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{item.materialName}</p>
                              <p className="text-xs text-muted-foreground">
                                Workbook code: <span className="font-mono">{item.workbookCode}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Suggested category: {suggestPerfumersWorldCategory({ workbookCode: item.workbookCode, name: item.materialName }).category?.label || 'Please choose manually'}
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              Needed for {item.grams.toFixed(4)} g
                            </Badge>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                              label="Material name"
                              value={draft.name}
                              onChange={(event) => updateMissingMaterialDraft(key, 'name', event.target.value)}
                            />
                            <FormField
                              label="Workbook code"
                              value={draft.workbook_code}
                              onChange={(event) => updateMissingMaterialDraft(key, 'workbook_code', event.target.value)}
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <FormSelect
                              label="Category"
                              value={draft.category}
                              onChange={(value) => updateMissingMaterialDraft(key, 'category', value)}
                              options={categoryOptions}
                              error={validationErrors[`${key}.category`]}
                              required
                              placeholder={categoryOptions.length ? 'Select category' : 'Create category first'}
                            />
                            <FormNumber
                              label="Stock quantity"
                              value={draft.stock_quantity}
                              onChange={(event) => updateMissingMaterialDraft(key, 'stock_quantity', event.target.value)}
                              error={validationErrors[`${key}.stock_quantity`]}
                              required
                              min="0"
                              step="0.01"
                            />
                            <FormSelect
                              label="Unit"
                              value={draft.unit}
                              onChange={(value) => updateMissingMaterialDraft(key, 'unit', value)}
                              options={[
                                { value: 'ml', label: 'ml' },
                                { value: 'g', label: 'g' },
                                { value: 'kg', label: 'kg' },
                                { value: 'oz', label: 'oz' },
                                { value: 'lb', label: 'lb' },
                              ]}
                              error={validationErrors[`${key}.unit`]}
                              required
                            />
                            <FormNumber
                              label="Minimum stock"
                              value={draft.minimum_stock}
                              onChange={(event) => updateMissingMaterialDraft(key, 'minimum_stock', event.target.value)}
                              error={validationErrors[`${key}.minimum_stock`]}
                              required
                              min="0"
                              step="0.01"
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <FormNumber
                              label="Unit price (per 10 ml)"
                              value={draft.cost_per_unit}
                              onChange={(event) => updateMissingMaterialDraft(key, 'cost_per_unit', event.target.value)}
                              min="0"
                              step="0.01"
                            />
                            <FormNumber
                              label="Low stock threshold"
                              value={draft.low_stock_threshold}
                              onChange={(event) => updateMissingMaterialDraft(key, 'low_stock_threshold', event.target.value)}
                              min="0"
                              step="0.01"
                            />
                            <FormField
                              label="Vendor"
                              value={draft.vendor}
                              onChange={(event) => updateMissingMaterialDraft(key, 'vendor', event.target.value)}
                              placeholder="Optional"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Material notes</label>
                            <Textarea
                              value={draft.notes}
                              onChange={(event) => updateMissingMaterialDraft(key, 'notes', event.target.value)}
                              rows={2}
                              placeholder="Optional note for this raw material"
                            />
                          </div>
                        </div>
                      );
                    })}
                    {missingSolventEntries.map((solventName) => {
                      const key = buildMissingSolventKey(solventName);
                      const draft = missingMaterialDrafts[key] || createMissingSolventDraft(solventName);

                      return (
                        <div key={key} className="rounded-xl border p-4 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{solventName}</p>
                              <p className="text-xs text-muted-foreground">
                                Dilution solvent from imported formula
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">Solvent</Badge>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <FormSelect
                              label="Category"
                              value={draft.category}
                              onChange={(value) => updateMissingMaterialDraft(key, 'category', value)}
                              options={categoryOptions}
                              error={validationErrors[`${key}.category`]}
                              required
                            />
                            <FormNumber
                              label="Stock quantity"
                              value={draft.stock_quantity}
                              onChange={(event) => updateMissingMaterialDraft(key, 'stock_quantity', event.target.value)}
                              error={validationErrors[`${key}.stock_quantity`]}
                              required
                              min="0"
                              step="0.01"
                            />
                            <FormSelect
                              label="Unit"
                              value={draft.unit}
                              onChange={(value) => updateMissingMaterialDraft(key, 'unit', value)}
                              options={[
                                { value: 'ml', label: 'ml' },
                                { value: 'g', label: 'g' },
                                { value: 'kg', label: 'kg' },
                                { value: 'oz', label: 'oz' },
                                { value: 'lb', label: 'lb' },
                              ]}
                              error={validationErrors[`${key}.unit`]}
                              required
                            />
                            <FormNumber
                              label="Minimum stock"
                              value={draft.minimum_stock}
                              onChange={(event) => updateMissingMaterialDraft(key, 'minimum_stock', event.target.value)}
                              error={validationErrors[`${key}.minimum_stock`]}
                              required
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!parseResult || isBusy}>
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import formula'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ImportFormulaPdfModal;
