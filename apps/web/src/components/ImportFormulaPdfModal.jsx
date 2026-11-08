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
import { buildRawMaterialSemanticLookupKey, createRawMaterial, getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { formatGramAmount } from '@/utils/formatting.js';
import { findPerfumersWorldCategoryByValue } from '@/utils/perfumersWorldCategories.js';
import { suggestPerfumersWorldCategory } from '@/utils/perfumersWorldCategorySuggestions.js';
import { parseDilutionFromMaterialName } from '@/utils/formulaDilutionParsing.js';
import { FORMULA_CATEGORIES } from '@/utils/constants.js';
import {
  buildMobileImportErrorMessage,
  getMissingMobileCapabilities,
  isMobileLikeRuntime,
  recordMobileRuntimeError,
} from '@/utils/mobileDiagnostics.js';

const normalizeLookupValue = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
const normalizeOptionalText = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const buildMissingMaterialKey = (item) => `${item.workbookCode}::${normalizeLookupValue(item.pureMaterialName || item.materialName)}`;
const buildMissingSolventKey = (solventName) => `solvent::${normalizeLookupValue(solventName)}`;

const createMissingMaterialDraft = (item) => ({
  name: item.pureMaterialName || item.materialName,
  workbook_code: item.workbookCode,
  category: suggestPerfumersWorldCategory({ workbookCode: item.workbookCode, name: item.materialName }).category?.label.toLowerCase() || '',
  type: 'material',
  unit: 'ml',
  cost_per_unit: '',
  vendor: '',
  notes: '',
});

const createMissingSolventDraft = (solventName) => ({
  name: solventName,
  workbook_code: '',
  category: 'z - zolvents',
  type: 'solvent',
  unit: 'ml',
  cost_per_unit: '',
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
  const [formulaCategory, setFormulaCategory] = useState('perfume');
  const [formulaAuthor, setFormulaAuthor] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const [notes, setNotes] = useState('');
  const [missingMaterialDrafts, setMissingMaterialDrafts] = useState({});
  const [validationErrors, setValidationErrors] = useState({});
  const mobileImportWarnings = useMemo(() => {
    if (!isMobileLikeRuntime()) {
      return [];
    }

    return getMissingMobileCapabilities();
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadReferenceData = async () => {
      setLoadingReferenceData(true);
      try {
        const [materialsData, categories] = await Promise.all([
          getRawMaterialOptions(),
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
        toast.error('Gagal memuat data rujukan impor');
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
      setFormulaCategory('perfume');
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

      const semanticKey = buildRawMaterialSemanticLookupKey(material.name) || normalizeLookupValue(material.name);
      byName.set(semanticKey, material);
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
      const nameMatch = rawMaterialLookup.byName.get(
        buildRawMaterialSemanticLookupKey(dilutionInfo.pureName) || normalizeLookupValue(dilutionInfo.pureName)
      );
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
      const { parsePerfumeWorkbookPdf } = await import('@/utils/perfumeWorkbookPdfParser.js');
      const parsedResult = await parsePerfumeWorkbookPdf(file);
      setParseResult(parsedResult);
      setFormulaName(parsedResult.formulaName || file.name.replace(/\.pdf$/i, ''));
      setFormulaCategory('perfume');
      setInternalCode('');
      setFormulaAuthor('');
      setNotes('');
      toast.success(`${parsedResult.items.length} baris formula terbaca dari PDF`);
    } catch (error) {
      recordMobileRuntimeError(error, {
        source: 'formula-pdf-import',
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      const message = buildMobileImportErrorMessage(error);
      setParseError(message);
      toast.error(message);
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
      nextErrors.formulaName = 'Nama formula wajib diisi';
    }

    [...missingMaterialEntries, ...missingSolventEntries.map((solventName) => ({ solventName, key: buildMissingSolventKey(solventName) }))].forEach((entry) => {
      const isSolventEntry = Boolean(entry.solventName);
      const key = isSolventEntry ? entry.key : buildMissingMaterialKey(entry);
      const draft = missingMaterialDrafts[key];

      if (!draft?.category) {
        nextErrors[`${key}.category`] = 'Kategori wajib diisi';
      }

      if (!draft?.unit) {
        nextErrors[`${key}.unit`] = 'Satuan wajib diisi';
      }
    });

    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!parseResult) {
      toast.error('Pilih PDF Perfume Workbook dulu');
      return;
    }

    if (!validateBeforeSubmit()) {
      toast.error('Lengkapi dulu detail bahan yang belum ada');
      return;
    }

    setSubmitting(true);

    try {
      const createdMaterials = new Map();
      const createdSolvents = new Map();
      const reusedMatches = [];

      for (const item of missingMaterialEntries) {
        const key = buildMissingMaterialKey(item);
        const draft = missingMaterialDrafts[key];
        const createdMaterial = await createRawMaterial({
          name: normalizeOptionalText(draft.name) || item.pureMaterialName || item.materialName,
          workbook_code: normalizeOptionalText(draft.workbook_code),
          category: draft.category,
          type: draft.type || 'material',
          unit: draft.unit,
          cost_per_unit: draft.cost_per_unit === '' ? 0 : Number(draft.cost_per_unit),
          vendor: normalizeOptionalText(draft.vendor),
          cas_number: null,
          ifra_limit: null,
          notes: normalizeOptionalText(draft.notes) || `Imported from ${parseResult.fileName}`,
          is_diluted: false,
          dilution_solvent_id: null,
          dilution_percentage: null,
          scent_family: null,
        });

        createdMaterials.set(key, createdMaterial);
        if (createdMaterial?._creationResolution?.action === 'matched_existing') {
          reusedMatches.push(createdMaterial._creationResolution.message);
        }
      }

      for (const solventName of missingSolventEntries) {
        const key = buildMissingSolventKey(solventName);
        const draft = missingMaterialDrafts[key];
        const createdSolvent = await createRawMaterial({
          name: normalizeOptionalText(draft.name) || solventName,
          workbook_code: null,
          category: draft.category,
          type: 'solvent',
          unit: draft.unit,
          cost_per_unit: draft.cost_per_unit === '' ? 0 : Number(draft.cost_per_unit),
          vendor: normalizeOptionalText(draft.vendor),
          cas_number: null,
          ifra_limit: null,
          notes: normalizeOptionalText(draft.notes) || `Imported as solvent from ${parseResult.fileName}`,
          is_diluted: false,
          dilution_solvent_id: null,
          dilution_percentage: null,
          scent_family: null,
        });

        createdSolvents.set(key, createdSolvent);
        if (createdSolvent?._creationResolution?.action === 'matched_existing') {
          reusedMatches.push(createdSolvent._creationResolution.message);
        }
      }

      const itemsForSubmit = matchedItems.map((item, index) => {
        const material = item.matchedMaterial || createdMaterials.get(buildMissingMaterialKey(item));
        const dilutionSolvent = item.isDilutedInFormula
          ? item.matchedSolvent || createdSolvents.get(buildMissingSolventKey(item.dilutionSolventName))
          : null;

        if (!material) {
          throw new Error(`Bahan baku untuk ${item.materialName} belum terpetakan`);
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

      const createdFormula = await createFormula(
        {
          name: formulaName.trim(),
          code: internalCode.trim() || undefined,
          category: formulaCategory,
          author_name: formulaAuthor.trim() || null,
          status: 'draft',
          notes: buildImportNotes({ customNotes: notes, parseResult }),
        },
        itemsForSubmit
      );

      if (reusedMatches.length) {
        toast.info(`${reusedMatches.length} bahan baku yang sudah ada dipakai ulang saat impor.`);
      }
      toast.success('Formula diimpor');
      onOpenChange(false);
      if (onSuccess) {
        onSuccess(createdFormula);
      }
    } catch (error) {
      toast.error(error.message || 'Gagal mengimpor formula');
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = loadingReferenceData || parsing || submitting || loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-[calc(100vw-1rem)] overflow-y-auto p-4 sm:max-w-5xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Impor formula dari PDF Perfume Workbook</DialogTitle>
          <DialogDescription>
            Unggah PDF workbook, periksa formula yang terbaca, lalu lengkapi bahan baru sebelum formulanya disimpan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-xl border border-dashed bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileUp className="h-4 w-4" />
              Unggah PDF
            </div>
            <Input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileChange}
              disabled={isBusy}
            />
            {mobileImportWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Browser HP ini belum lengkap untuk impor lokal: {mobileImportWarnings.join(', ')}. Jika impor gagal, muat ulang aplikasi setelah pembaruan atau coba dari browser HP versi terbaru.
              </div>
            )}
            {selectedFileName && (
              <p className="text-xs text-muted-foreground">Berkas terpilih: {selectedFileName}</p>
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
                    <Badge variant="secondary">{matchedItems.length} baris terbaca</Badge>
                    <Badge variant="outline">{missingMaterialEntries.length} bahan baru</Badge>
                    <Badge variant="outline">{missingSolventEntries.length} pelarut baru</Badge>
                    <Badge variant="outline">{matchedItems.length - missingMaterialEntries.length} bahan cocok</Badge>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Nama formula"
                      value={formulaName}
                      onChange={(event) => setFormulaName(event.target.value)}
                      error={validationErrors.formulaName}
                      required
                    />
                    <FormField
                      label="Pembuat"
                      value={formulaAuthor}
                      onChange={(event) => setFormulaAuthor(event.target.value)}
                    placeholder="mis. Solivagant"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormSelect
                      label="Kategori formula"
                      value={formulaCategory}
                      onChange={setFormulaCategory}
                      options={FORMULA_CATEGORIES}
                    />
                    <FormField
                      label="Kode internal"
                      value={internalCode}
                      onChange={(event) => setInternalCode(event.target.value)}
                      placeholder="Opsional, dibuat otomatis jika kosong"
                    />
                    <div className="space-y-2 text-sm col-span-2">
                      <p className="font-medium">Sumber workbook</p>
                      <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                        <p>Kode formula: {parseResult.workbookFormulaCode || '-'}</p>
                        <p>WS: {parseResult.workbookSheet || '-'}</p>
                        <p>Harga: {parseResult.pricePerGram || '-'}</p>
                        <p>Total: {formatGramAmount(parseResult.totalGrams)}</p>
                        <p>Tanggal: {parseResult.formulaDate || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Catatan impor</label>
                    <Textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={3}
                      placeholder="Catatan opsional yang disimpan bersama formula impor ini"
                    />
                  </div>
                </div>

                <div className="rounded-xl border p-4 space-y-3">
                  <p className="text-sm font-medium">Kesiapan impor</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{matchedItems.length - missingMaterialEntries.length} bahan sudah ada di pustaka bahan</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{missingMaterialEntries.length} bahan perlu dilengkapi untuk pustaka bahan</span>
                    </div>
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{missingSolventEntries.length} pelarut pengenceran mungkin perlu dilengkapi untuk pustaka bahan</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bahan yang sudah ada dicocokkan lewat kode workbook dulu, lalu lewat nama bahan baku.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border overflow-hidden">
                <div className="border-b bg-muted/30 px-4 py-3">
                  <p className="text-sm font-medium">Baris formula yang terbaca</p>
                </div>
                <div className="space-y-3 p-4 md:hidden">
                  {matchedItems.map((item) => (
                    <div key={`${item.lineNumber}-${item.workbookCode}-${item.materialName}`} className="rounded-xl border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                            Baris {item.lineNumber}
                          </div>
                          <div className="mt-1 text-sm font-medium">{item.pureMaterialName}</div>
                          {item.isDilutedInFormula ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {item.dilutionPercent}% dalam {item.dilutionSolventName}
                            </div>
                          ) : null}
                        </div>
                        <Badge variant={item.matchedMaterial ? 'outline' : 'secondary'} className="shrink-0 text-[10px]">
                          {item.matchedMaterial ? 'Cocok' : 'Baru'}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground">Kode workbook</div>
                          <div className="mt-1 font-mono">{item.workbookCode}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Jumlah</div>
                          <div className="mt-1 font-mono">{item.grams.toFixed(4)} g</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden max-h-72 overflow-y-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">No</TableHead>
                        <TableHead className="w-28">Kode workbook</TableHead>
                        <TableHead>Bahan baku</TableHead>
                        <TableHead className="text-right w-28">Jumlah (g)</TableHead>
                        <TableHead className="w-48">Status cocok</TableHead>
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
                                {item.dilutionPercent}% dalam {item.dilutionSolventName}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">{item.grams.toFixed(4)}</TableCell>
                          <TableCell>
                            {item.matchedMaterial ? (
                              <Badge variant="outline" className="text-xs">
                                Sudah ada: {item.matchedMaterial.name}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Perlu bahan baru
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
                    <p className="text-sm font-medium">Bahan baru yang akan dibuat</p>
                    <p className="text-xs text-muted-foreground">
                      Cukup isi sekali. Bahan murni dan pelarut pengenceran yang dibuat di sini otomatis dipakai ulang pada impor berikutnya.
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
                                Kode workbook: <span className="font-mono">{item.workbookCode}</span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Saran kategori: {suggestPerfumersWorldCategory({ workbookCode: item.workbookCode, name: item.materialName }).category?.label || 'Pilih sendiri'}
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              Dibutuhkan {item.grams.toFixed(4)} g
                            </Badge>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                              label="Nama bahan"
                              value={draft.name}
                              onChange={(event) => updateMissingMaterialDraft(key, 'name', event.target.value)}
                            />
                            <FormField
                              label="Kode workbook"
                              value={draft.workbook_code}
                              onChange={(event) => updateMissingMaterialDraft(key, 'workbook_code', event.target.value)}
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <FormSelect
                              label="Kategori"
                              value={draft.category}
                              onChange={(value) => updateMissingMaterialDraft(key, 'category', value)}
                              options={categoryOptions}
                              error={validationErrors[`${key}.category`]}
                              required
                              placeholder={categoryOptions.length ? 'Pilih kategori' : 'Buat kategori dulu'}
                            />
                            <FormSelect
                              label="Satuan"
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
                            <FormField
                              label="Supplier"
                              value={draft.vendor}
                              onChange={(event) => updateMissingMaterialDraft(key, 'vendor', event.target.value)}
                              placeholder="Opsional"
                            />
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <FormNumber
                              label={`Harga satuan (per 10 ${draft.unit || 'ml'})`}
                              value={draft.cost_per_unit}
                              onChange={(event) => updateMissingMaterialDraft(key, 'cost_per_unit', event.target.value)}
                              min="0"
                              step="0.01"
                            />
                            <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                              Bahan impor ini masuk ke pustaka bahan, dengan metadata yang siap diberi panduan.
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium">Catatan bahan</label>
                            <Textarea
                              value={draft.notes}
                              onChange={(event) => updateMissingMaterialDraft(key, 'notes', event.target.value)}
                              rows={2}
                              placeholder="Catatan opsional untuk bahan baku ini"
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
                                Pelarut pengenceran dari formula yang diimpor
                              </p>
                            </div>
                            <Badge variant="secondary" className="text-xs">Pelarut</Badge>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <FormSelect
                              label="Kategori"
                              value={draft.category}
                              onChange={(value) => updateMissingMaterialDraft(key, 'category', value)}
                              options={categoryOptions}
                              error={validationErrors[`${key}.category`]}
                              required
                            />
                            <FormSelect
                              label="Satuan"
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
                              label={`Harga satuan (per 10 ${draft.unit || 'ml'})`}
                              value={draft.cost_per_unit}
                              onChange={(event) => updateMissingMaterialDraft(key, 'cost_per_unit', event.target.value)}
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
              Batal
            </Button>
            <Button type="submit" disabled={!parseResult || isBusy}>
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Mengimpor...
                </>
              ) : (
                'Impor formula'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ImportFormulaPdfModal;
