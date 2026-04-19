import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle2, FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAccords } from '@/hooks/useAccords.js';
import FormField from '@/components/FormField.jsx';
import FormNumber from '@/components/FormNumber.jsx';
import FormSelect from '@/components/FormSelect.jsx';
import { getRawMaterialCategories } from '@/services/rawMaterialCategoriesService.js';
import { createRawMaterial, getRawMaterials } from '@/services/rawMaterialsService.js';
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

const ImportAccordPdfModal = ({ open, onOpenChange, onSuccess }) => {
  const { addAccord, loading } = useAccords();
  const [rawMaterials, setRawMaterials] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [loadingReferenceData, setLoadingReferenceData] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parseResult, setParseResult] = useState(null);
  const [parseError, setParseError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accordName, setAccordName] = useState('');
  const [accordAuthor, setAccordAuthor] = useState('');
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
      setAccordName('');
      setAccordAuthor('');
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
        isDilutedInAccord: dilutionInfo.isDilutedInFormula,
        dilutionPercent: dilutionInfo.dilutionPercent,
        dilutionSolventName: dilutionInfo.solventName,
        matchedMaterial,
        matchedSolvent: solventMatch,
      };
    });
  }, [parseResult, rawMaterialLookup]);

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
      if (!item.isDilutedInAccord || item.matchedSolvent || !item.dilutionSolventName) {
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
      const { parsePerfumeWorkbookPdf } = await import('@/utils/perfumeWorkbookPdfParser.js');
      const parsedResult = await parsePerfumeWorkbookPdf(file);
      setParseResult(parsedResult);
      setAccordName(parsedResult.formulaName || file.name.replace(/\.pdf$/i, ''));
      setAccordAuthor('');
      setNotes('');
      toast.success(`Parsed ${parsedResult.items.length} accord items from PDF`);
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

    if (!accordName.trim()) {
      nextErrors.accordName = 'Accord name is required';
    }

    missingMaterialEntries.forEach((entry) => {
      const key = buildMissingMaterialKey(entry);
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

    missingSolventEntries.forEach((solventName) => {
      const key = buildMissingSolventKey(solventName);
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
          name: draft.name,
          workbook_code: draft.workbook_code || null,
          category: draft.category || null,
          type: draft.type || 'material',
          stock_quantity: Number(draft.stock_quantity || 0),
          unit: draft.unit || 'ml',
          cost_per_unit: Number(draft.cost_per_unit || 0),
          minimum_stock: Number(draft.minimum_stock || 0),
          low_stock_threshold: draft.low_stock_threshold === '' ? null : Number(draft.low_stock_threshold || 0),
          vendor: draft.vendor || null,
          notes: draft.notes || null,
        });

        createdMaterials.set(key, createdMaterial);
      }

      for (const solventName of missingSolventEntries) {
        const key = buildMissingSolventKey(solventName);
        const draft = missingMaterialDrafts[key];
        const createdSolvent = await createRawMaterial({
          name: draft.name,
          workbook_code: null,
          category: draft.category || null,
          type: 'solvent',
          stock_quantity: Number(draft.stock_quantity || 0),
          unit: draft.unit || 'ml',
          cost_per_unit: Number(draft.cost_per_unit || 0),
          minimum_stock: Number(draft.minimum_stock || 0),
          low_stock_threshold: draft.low_stock_threshold === '' ? null : Number(draft.low_stock_threshold || 0),
          vendor: draft.vendor || null,
          notes: draft.notes || null,
        });

        createdSolvents.set(key, createdSolvent);
      }

      const itemsForSubmit = matchedItems.map((item) => {
        const material =
          item.matchedMaterial ||
          createdMaterials.get(buildMissingMaterialKey(item));
        const dilutionSolvent = item.isDilutedInAccord
          ? item.matchedSolvent || createdSolvents.get(buildMissingSolventKey(item.dilutionSolventName))
          : null;

        return {
          raw_material_id: material.id,
          percentage: item.percentage,
          dilution_percent: item.isDilutedInAccord ? item.dilutionPercent : null,
          dilution_solvent_id: dilutionSolvent?.id || null,
          concentrate_amount: item.isDilutedInAccord
            ? Number(((item.grams * item.dilutionPercent) / 100).toFixed(3))
            : null,
        };
      });

      await addAccord(
        {
          name: accordName.trim(),
          author_name: accordAuthor.trim() || null,
          notes: buildImportNotes({ customNotes: notes, parseResult }),
          unit: 'ml',
        },
        itemsForSubmit
      );

      toast.success('Accord imported successfully');
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      toast.error(error.message || 'Failed to import accord');
    } finally {
      setSubmitting(false);
    }
  };

  const matchedCount = matchedItems.filter((item) => item.matchedMaterial).length;
  const readyToImport = parseResult && !parseError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Import accord from Perfume Workbook PDF</DialogTitle>
          <DialogDescription>
            Parse a workbook PDF, match raw materials, then create an accord from the composition percentages.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-dashed bg-muted/30 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium">Choose PDF file</p>
                <p className="text-xs text-muted-foreground">
                  Best results come from Perfume Workbook export PDFs with code and gram lines.
                </p>
              </div>
              <label className="inline-flex">
                <input
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={parsing || submitting}
                />
                <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-4 text-sm font-medium shadow-sm">
                  {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  {parsing ? 'Parsing PDF...' : 'Select PDF'}
                </span>
              </label>
            </div>
            {selectedFileName && (
              <p className="mt-3 text-xs text-muted-foreground">Selected file: {selectedFileName}</p>
            )}
            {parseError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}
          </div>

          {readyToImport && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <FormField
                  label="Accord name"
                  required
                  value={accordName}
                  onChange={(event) => setAccordName(event.target.value)}
                  error={validationErrors.accordName}
                />
                <FormField
                  label="By"
                  value={accordAuthor}
                  onChange={(event) => setAccordAuthor(event.target.value)}
                  placeholder="Optional creator name"
                />
                <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total imported amount</span>
                    <span className="font-mono font-semibold">{formatGramAmount(parseResult.totalGrams)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Matched materials</span>
                    <span className="font-medium">{matchedCount} / {matchedItems.length}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="accord-import-notes" className="text-sm font-medium">Notes</label>
                <Textarea
                  id="accord-import-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes for this imported accord"
                  rows={3}
                  className="text-foreground text-sm"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Items parsed</div>
                  <div className="mt-1 text-lg font-semibold">{matchedItems.length}</div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Matched automatically</div>
                  <div className="mt-1 text-lg font-semibold text-primary">{matchedCount}</div>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-xs text-muted-foreground">Missing materials</div>
                  <div className="mt-1 text-lg font-semibold">{missingMaterialEntries.length}</div>
                </div>
              </div>

              <div className="rounded-lg border bg-card overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workbook code</TableHead>
                      <TableHead>Material name</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Percentage</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {matchedItems.map((item) => (
                      <TableRow key={`${item.lineNumber}-${item.workbookCode}-${item.materialName}`}>
                        <TableCell className="font-mono text-xs">{item.workbookCode || '-'}</TableCell>
                        <TableCell className="text-sm">
                          {item.pureMaterialName}
                          {item.isDilutedInAccord && (
                            <div className="text-xs text-muted-foreground">
                              {item.dilutionPercent}% in {item.dilutionSolventName}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{formatGramAmount(item.grams)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{item.percentage.toFixed(3)}%</TableCell>
                        <TableCell>
                          {item.matchedMaterial ? (
                            <Badge variant="default" className="gap-1 text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              {item.matchedMaterial.name}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Needs material</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {(missingMaterialEntries.length > 0 || missingSolventEntries.length > 0) && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-semibold">Create missing raw materials</h3>
                    <p className="text-sm text-muted-foreground">
                      These materials were not found in your catalog. Complete them once here and they will be created during import.
                    </p>
                  </div>

                  {missingMaterialEntries.map((item) => {
                    const key = buildMissingMaterialKey(item);
                    const draft = missingMaterialDrafts[key] || createMissingMaterialDraft(item);

                    return (
                      <div key={key} className="rounded-xl border p-4 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{draft.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Workbook code: {item.workbookCode || '-'}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">New raw material</Badge>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <FormField
                            label="Material name"
                            value={draft.name}
                            onChange={(event) => updateMissingMaterialDraft(key, 'name', event.target.value)}
                            error={validationErrors[`${key}.name`]}
                          />
                          <FormField
                            label="Workbook code"
                            value={draft.workbook_code}
                            onChange={(event) => updateMissingMaterialDraft(key, 'workbook_code', event.target.value)}
                            error={validationErrors[`${key}.workbook_code`]}
                          />
                          <FormSelect
                            label="Category"
                            value={draft.category}
                            onChange={(value) => updateMissingMaterialDraft(key, 'category', value)}
                            placeholder={loadingReferenceData ? 'Loading categories...' : 'Select category'}
                            options={categoryOptions}
                            error={validationErrors[`${key}.category`]}
                          />
                          <FormSelect
                            label="Unit"
                            value={draft.unit}
                            onChange={(value) => updateMissingMaterialDraft(key, 'unit', value)}
                            options={[
                              { value: 'ml', label: 'ml' },
                              { value: 'g', label: 'g' },
                            ]}
                            error={validationErrors[`${key}.unit`]}
                          />
                          <FormNumber
                            label="Opening stock"
                            value={draft.stock_quantity}
                            onChange={(event) => updateMissingMaterialDraft(key, 'stock_quantity', event.target.value)}
                            error={validationErrors[`${key}.stock_quantity`]}
                            min="0"
                            step="0.01"
                          />
                          <FormNumber
                            label="Cost per unit"
                            value={draft.cost_per_unit}
                            onChange={(event) => updateMissingMaterialDraft(key, 'cost_per_unit', event.target.value)}
                            error={validationErrors[`${key}.cost_per_unit`]}
                            min="0"
                            step="0.01"
                          />
                          <FormNumber
                            label="Minimum stock"
                            value={draft.minimum_stock}
                            onChange={(event) => updateMissingMaterialDraft(key, 'minimum_stock', event.target.value)}
                            error={validationErrors[`${key}.minimum_stock`]}
                            min="0"
                            step="0.01"
                          />
                          <FormNumber
                            label="Low stock threshold"
                            value={draft.low_stock_threshold}
                            onChange={(event) => updateMissingMaterialDraft(key, 'low_stock_threshold', event.target.value)}
                            error={validationErrors[`${key}.low_stock_threshold`]}
                            min="0"
                            step="0.01"
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
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{draft.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Dilution solvent from imported accord
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-xs">New solvent</Badge>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <FormSelect
                            label="Category"
                            value={draft.category}
                            onChange={(value) => updateMissingMaterialDraft(key, 'category', value)}
                            placeholder={loadingReferenceData ? 'Loading categories...' : 'Select category'}
                            options={categoryOptions}
                            error={validationErrors[`${key}.category`]}
                          />
                          <FormSelect
                            label="Unit"
                            value={draft.unit}
                            onChange={(value) => updateMissingMaterialDraft(key, 'unit', value)}
                            options={[
                              { value: 'ml', label: 'ml' },
                              { value: 'g', label: 'g' },
                            ]}
                            error={validationErrors[`${key}.unit`]}
                          />
                          <FormNumber
                            label="Opening stock"
                            value={draft.stock_quantity}
                            onChange={(event) => updateMissingMaterialDraft(key, 'stock_quantity', event.target.value)}
                            error={validationErrors[`${key}.stock_quantity`]}
                            min="0"
                            step="0.01"
                          />
                          <FormNumber
                            label="Minimum stock"
                            value={draft.minimum_stock}
                            onChange={(event) => updateMissingMaterialDraft(key, 'minimum_stock', event.target.value)}
                            error={validationErrors[`${key}.minimum_stock`]}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!readyToImport || submitting || loading}>
              {submitting ? 'Importing accord...' : 'Import accord'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ImportAccordPdfModal;
