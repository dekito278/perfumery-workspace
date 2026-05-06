import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getFormulas, getFormulaItems } from '@/services/formulasSupabaseService.js';
import { getRawMaterialOptions } from '@/services/rawMaterialsService.js';
import { calculateIngredientCost } from '@/utils/pricingUtils.js';
import { buildFormulaItemReferenceMaps, resolveFormulaItemReference } from '@/utils/legacyFormulaItemSources.js';
import {
  buildBulkRow,
  buildPackagingLineItems,
  clampPercentage,
  createBulkScenario,
  createDefaultBulkScenarios,
  createDefaultQuotationInputs,
  createDefaultRetailInputs,
  createDefaultRetailScenarios,
  DEFAULT_BULK_INPUTS,
  DEFAULT_RETAIL_INPUTS,
  normalizeBulkScenario,
  parseNumberInput,
  readLocalScenario,
  writeLocalScenario,
} from '@/utils/productionCosting.js';
import {
  buildProductionCostExportConfig,
  buildProductionQuotationExportConfig,
} from '@/utils/productionCostingExports.js';

const importWorkbookActions = () => import('@/utils/workbookPdfExport.js');

export const useProductionCostPage = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('retail');
  const [formulas, setFormulas] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState('');
  const [selectedSolventId, setSelectedSolventId] = useState('');
  const [formulaProfile, setFormulaProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [retailInputs, setRetailInputs] = useState(DEFAULT_RETAIL_INPUTS);
  const [bulkInputs, setBulkInputs] = useState(DEFAULT_BULK_INPUTS);
  const [retailScenarios, setRetailScenarios] = useState(createDefaultRetailScenarios);
  const [bulkScenarios, setBulkScenarios] = useState(createDefaultBulkScenarios);
  const [quotationInputs, setQuotationInputs] = useState(createDefaultQuotationInputs);
  const [quotationOpen, setQuotationOpen] = useState(false);

  useEffect(() => {
    const loadReferenceData = async () => {
      setLoading(true);
      try {
        const [formulasData, rawMaterialsData] = await Promise.all([
          getFormulas(),
          getRawMaterialOptions(),
        ]);

        setFormulas(formulasData);
        setRawMaterials(rawMaterialsData);

        const firstFormulaId = formulasData[0]?.id || '';
        const firstSolventId = rawMaterialsData.find((material) => material.type === 'solvent')?.id || '';
        setSelectedFormulaId(firstFormulaId);
        setSelectedSolventId(firstSolventId);
      } catch {
        toast.error('Failed to load production costing data');
      } finally {
        setLoading(false);
      }
    };

    loadReferenceData();
  }, []);

  const selectedFormula = formulas.find((formula) => formula.id === selectedFormulaId) || null;

  useEffect(() => {
    if (!selectedFormulaId) {
      setRetailInputs(DEFAULT_RETAIL_INPUTS);
      setBulkInputs(DEFAULT_BULK_INPUTS);
      setRetailScenarios(createDefaultRetailScenarios());
      const nextBulkScenarios = createDefaultBulkScenarios();
      setBulkScenarios(nextBulkScenarios);
      setQuotationInputs(createDefaultQuotationInputs());
      return;
    }

    const persistedScenario = readLocalScenario(selectedFormulaId);
    if (persistedScenario) {
      const nextBulkScenarios = Array.isArray(persistedScenario.bulkScenarios) && persistedScenario.bulkScenarios.length
        ? persistedScenario.bulkScenarios.map((scenario, index) => (
          normalizeBulkScenario(scenario, createBulkScenario(index + 1))
        ))
        : createDefaultBulkScenarios();

      setRetailInputs({
        ...createDefaultRetailInputs(selectedFormula),
        ...(persistedScenario.retailInputs || {}),
      });
      setBulkInputs({
        ...DEFAULT_BULK_INPUTS,
        ...(persistedScenario.bulkInputs || {}),
      });
      setRetailScenarios(
        Array.isArray(persistedScenario.retailScenarios) && persistedScenario.retailScenarios.length
          ? persistedScenario.retailScenarios
          : createDefaultRetailScenarios()
      );
      setBulkScenarios(nextBulkScenarios);
      setQuotationInputs({
        ...createDefaultQuotationInputs(),
        ...(persistedScenario.quotationInputs || {}),
        selectedScenarioId: persistedScenario.quotationInputs?.selectedScenarioId || nextBulkScenarios[0]?.id || '',
      });
      return;
    }

    const nextBulkScenarios = createDefaultBulkScenarios();
    setRetailInputs(createDefaultRetailInputs(selectedFormula));
    setBulkInputs(DEFAULT_BULK_INPUTS);
    setRetailScenarios(createDefaultRetailScenarios());
    setBulkScenarios(nextBulkScenarios);
    setQuotationInputs({
      ...createDefaultQuotationInputs(),
      selectedScenarioId: nextBulkScenarios[0]?.id || '',
    });
  }, [selectedFormulaId, selectedFormula]);

  useEffect(() => {
    if (!selectedFormulaId) {
      return;
    }

    writeLocalScenario(selectedFormulaId, {
      retailInputs,
      bulkInputs,
      retailScenarios,
      bulkScenarios,
      quotationInputs,
    });
  }, [selectedFormulaId, retailInputs, bulkInputs, retailScenarios, bulkScenarios, quotationInputs]);

  useEffect(() => {
    if (!bulkScenarios.length) {
      return;
    }

    setQuotationInputs((current) => {
      const hasSelectedScenario = bulkScenarios.some((scenario) => scenario.id === current.selectedScenarioId);
      if (hasSelectedScenario) {
        return current;
      }

      return {
        ...current,
        selectedScenarioId: bulkScenarios[0]?.id || '',
      };
    });
  }, [bulkScenarios]);

  useEffect(() => {
    const loadFormulaProfile = async () => {
      if (!selectedFormulaId) {
        setFormulaProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        const items = await getFormulaItems(selectedFormulaId);
        const referenceMaps = await buildFormulaItemReferenceMaps(items, rawMaterials);

        const enrichedItems = items.map((item) => {
          const sourceItem = resolveFormulaItemReference(item, referenceMaps);
          const gramAmount = Number(item.grams || 0);
          const unitPrice = Number(sourceItem?.cost_per_unit || 0);

          return {
            ...item,
            name: sourceItem?.name || 'Unknown',
            gram_amount: gramAmount,
            unit_price: unitPrice,
            ingredient_cost: calculateIngredientCost(gramAmount, unitPrice),
          };
        });

        const totalGrams = enrichedItems.reduce((sum, item) => sum + Number(item.gram_amount || 0), 0);
        const totalMaterialCost = enrichedItems.reduce((sum, item) => sum + Number(item.ingredient_cost || 0), 0);

        setFormulaProfile({
          items: enrichedItems,
          totalGrams,
          totalMaterialCost,
          costPerMl: totalGrams > 0 ? totalMaterialCost / totalGrams : 0,
        });
      } catch {
        toast.error('Failed to load formula profile');
        setFormulaProfile(null);
      } finally {
        setProfileLoading(false);
      }
    };

    if (!loading) {
      loadFormulaProfile();
    }
  }, [selectedFormulaId, rawMaterials, loading]);

  const solventOptions = useMemo(
    () => rawMaterials.filter((material) => material.type === 'solvent'),
    [rawMaterials]
  );

  const selectedSolvent = solventOptions.find((material) => material.id === selectedSolventId) || null;

  const retailComputed = useMemo(() => {
    const targetFillVolume = parseNumberInput(retailInputs.totalBatchVolume);
    const concentration = clampPercentage(parseNumberInput(retailInputs.formulaPercentage));
    const unitBottleSize = parseNumberInput(retailInputs.bottleSize);
    const lossPercent = clampPercentage(parseNumberInput(retailInputs.productionLossPercent));
    const yieldRatio = Math.max(1 - (lossPercent / 100), 0.0001);
    const requiredProductionVolume = targetFillVolume > 0 ? targetFillVolume / yieldRatio : 0;

    const formulaVolumeNeeded = requiredProductionVolume * (concentration / 100);
    const solventVolumeNeeded = Math.max(requiredProductionVolume - formulaVolumeNeeded, 0);
    const formulaMaterialCost = (formulaProfile?.costPerMl || 0) * formulaVolumeNeeded;
    const solventCostPerMl = selectedSolvent ? calculateIngredientCost(1, Number(selectedSolvent.cost_per_unit || 0)) : 0;
    const solventMaterialCost = solventCostPerMl * solventVolumeNeeded;
    const totalMaterialCost = formulaMaterialCost + solventMaterialCost;

    const bottleCount = unitBottleSize > 0 ? Math.floor(targetFillVolume / unitBottleSize) : 0;
    const remainingVolume = unitBottleSize > 0 ? Math.max(targetFillVolume - (bottleCount * unitBottleSize), 0) : 0;
    const packagingLineItems = buildPackagingLineItems(retailInputs, bottleCount);
    const perBottlePackagingCost = packagingLineItems.unitItems.reduce((sum, item) => sum + item.unitCost, 0);
    const totalPackagingCost = packagingLineItems.unitItems.reduce((sum, item) => sum + item.totalCost, 0);
    const totalBatchOverhead = packagingLineItems.batchItems.reduce((sum, item) => sum + item.totalCost, 0);
    const totalProductionCost = totalMaterialCost + totalPackagingCost + totalBatchOverhead;
    const costPerBottle = bottleCount > 0 ? totalProductionCost / bottleCount : 0;
    const materialCostPerBottle = bottleCount > 0 ? totalMaterialCost / bottleCount : 0;
    const cogsPerMl = targetFillVolume > 0 ? totalProductionCost / targetFillVolume : 0;

    const scenarioResults = retailScenarios.map((scenario) => {
      const percent = clampPercentage(parseNumberInput(scenario.percent), 1000);
      const feePercent = clampPercentage(parseNumberInput(scenario.feePercent));
      const salePrice = scenario.mode === 'margin'
        ? (percent >= 100 ? 0 : (costPerBottle / Math.max(1 - (percent / 100), 0.0001)))
        : costPerBottle * (1 + (percent / 100));
      const channelFee = salePrice * (feePercent / 100);
      const netRevenue = Math.max(salePrice - channelFee, 0);
      const profitPerBottle = netRevenue - costPerBottle;
      const profitMargin = netRevenue > 0 ? (profitPerBottle / netRevenue) * 100 : 0;

      return {
        ...scenario,
        percent,
        feePercent,
        salePrice,
        channelFee,
        netRevenue,
        profitPerBottle,
        profitMargin,
        batchProfit: profitPerBottle * bottleCount,
      };
    });

    return {
      targetFillVolume,
      concentration,
      unitBottleSize,
      lossPercent,
      requiredProductionVolume,
      formulaVolumeNeeded,
      solventVolumeNeeded,
      solventCostPerMl,
      formulaMaterialCost,
      solventMaterialCost,
      totalMaterialCost,
      bottleCount,
      remainingVolume,
      perBottlePackagingCost,
      totalPackagingCost,
      totalBatchOverhead,
      totalProductionCost,
      costPerBottle,
      materialCostPerBottle,
      cogsPerMl,
      packagingLineItems,
      scenarioResults,
    };
  }, [retailInputs, formulaProfile, retailScenarios, selectedSolvent]);

  const bulkComputed = useMemo(() => {
    const concentration = clampPercentage(parseNumberInput(retailInputs.formulaPercentage));
    const lossPercent = clampPercentage(parseNumberInput(bulkInputs.productionLossPercent));
    const yieldRatio = Math.max(1 - (lossPercent / 100), 0.0001);
    const formulaRatio = concentration / 100;
    const solventRatio = Math.max(1 - formulaRatio, 0);
    const formulaCogsPerMl = (formulaProfile?.costPerMl || 0) * formulaRatio / yieldRatio;
    const solventCogsPerMl = selectedSolvent
      ? calculateIngredientCost(1, Number(selectedSolvent.cost_per_unit || 0)) * solventRatio / yieldRatio
      : 0;
    const materialCogsPerMl = formulaCogsPerMl + solventCogsPerMl;
    const handlingCostPerLiter = parseNumberInput(bulkInputs.handlingCostPerLiter);
    const overheadPerLiter = parseNumberInput(bulkInputs.bulkOverheadCost);
    const allInBulkCogsPerLiter = (materialCogsPerMl * 1000) + handlingCostPerLiter + overheadPerLiter;

    const rows = bulkScenarios.map((scenario, index) => buildBulkRow({
      id: scenario.id,
      label: scenario.label || `Quote ${index + 1}`,
      volumeValue: scenario.volumeValue,
      volumeUnit: scenario.volumeUnit,
      materialCogsPerMl,
      handlingCostPerLiter,
      overheadPerLiter,
      bulkScenario: scenario,
    }));

    return {
      concentration,
      lossPercent,
      formulaCogsPerMl,
      solventCogsPerMl,
      materialCogsPerMl,
      handlingCostPerLiter,
      overheadPerLiter,
      allInBulkCogsPerLiter,
      rows,
    };
  }, [bulkInputs, bulkScenarios, formulaProfile, retailInputs.formulaPercentage, selectedSolvent]);

  const retailChampion = useMemo(
    () => retailComputed.scenarioResults.reduce((best, current) => (
      !best || current.profitPerBottle > best.profitPerBottle ? current : best
    ), null),
    [retailComputed.scenarioResults]
  );

  const bulkChampion = useMemo(
    () => bulkComputed.rows.reduce((best, current) => (
      !best || current.profit > best.profit ? current : best
    ), null),
    [bulkComputed.rows]
  );

  const updateRetailInput = (key, value) => {
    setRetailInputs((current) => ({ ...current, [key]: value }));
  };

  const updateBulkInput = (key, value) => {
    setBulkInputs((current) => ({ ...current, [key]: value }));
  };

  const updateRetailScenario = (scenarioId, key, value) => {
    setRetailScenarios((current) => current.map((scenario) => (
      scenario.id === scenarioId ? { ...scenario, [key]: value } : scenario
    )));
  };

  const updateBulkScenario = (scenarioId, key, value) => {
    setBulkScenarios((current) => current.map((scenario) => (
      scenario.id === scenarioId ? { ...scenario, [key]: value } : scenario
    )));
  };

  const addBulkScenario = () => {
    setBulkScenarios((current) => [
      ...current,
      createBulkScenario(current.length + 1),
    ]);
  };

  const removeBulkScenario = (scenarioId) => {
    setBulkScenarios((current) => (
      current.length <= 1 ? current : current.filter((scenario) => scenario.id !== scenarioId)
    ));
  };

  const updateQuotationInput = (key, value) => {
    setQuotationInputs((current) => ({ ...current, [key]: value }));
  };

  const selectedQuotationRow = useMemo(
    () => bulkComputed.rows.find((row) => row.id === quotationInputs.selectedScenarioId) || bulkComputed.rows[0] || null,
    [bulkComputed.rows, quotationInputs.selectedScenarioId]
  );

  const buildExportConfig = () => {
    if (!selectedFormula || !formulaProfile) {
      return null;
    }

    return buildProductionCostExportConfig({
      bulkComputed,
    formulaProfile,
      retailComputed,
      selectedFormula,
      selectedSolvent,
    });
  };

  const buildQuotationConfig = () => {
    if (!selectedFormula || !formulaProfile || !selectedQuotationRow) {
      return null;
    }

    return buildProductionQuotationExportConfig({
      bulkComputed,
      bulkScenarios,
      parseNumberInput,
      quotationInputs,
      selectedFormula,
      selectedQuotationRow,
      selectedSolvent,
    });
  };

  const withWorkbookExport = async (builder, message, action) => {
    const exportConfig = builder();
    if (!exportConfig) {
      toast.error(message);
      return;
    }

    const { exportWorkbookPdf, printWorkbookPdf } = await importWorkbookActions();
    await action({ exportWorkbookPdf, printWorkbookPdf, exportConfig });
  };

  const handleExportPdf = async () => withWorkbookExport(
    buildExportConfig,
    'Choose a formula first',
    async ({ exportWorkbookPdf, exportConfig }) => {
      exportWorkbookPdf(exportConfig, `${selectedFormula.code || 'production_cost'}_costing.pdf`);
    }
  );

  const handlePrint = async () => withWorkbookExport(
    buildExportConfig,
    'Choose a formula first',
    async ({ printWorkbookPdf, exportConfig }) => {
      printWorkbookPdf(exportConfig);
    }
  );

  const handleExportQuotationPdf = async () => withWorkbookExport(
    buildQuotationConfig,
    'Choose a formula and quote first',
    async ({ exportWorkbookPdf, exportConfig }) => {
      exportWorkbookPdf(exportConfig, `${selectedFormula.code || 'quotation'}_brand_quotation.pdf`);
    }
  );

  const handlePrintQuotation = async () => withWorkbookExport(
    buildQuotationConfig,
    'Choose a formula and quote first',
    async ({ printWorkbookPdf, exportConfig }) => {
      printWorkbookPdf(exportConfig);
    }
  );

  return {
    activeTab,
    addBulkScenario,
    bulkChampion,
    bulkComputed,
    bulkInputs,
    bulkScenarios,
    formulaProfile,
    formulas,
    handleExportPdf,
    handleExportQuotationPdf,
    handlePrint,
    handlePrintQuotation,
    loading,
    profileLoading,
    quotationInputs,
    quotationOpen,
    retailChampion,
    retailComputed,
    retailInputs,
    retailScenarios,
    selectedFormula,
    selectedFormulaId,
    selectedQuotationRow,
    selectedSolventId,
    setActiveTab,
    setQuotationOpen,
    setSelectedFormulaId,
    setSelectedSolventId,
    solventOptions,
    updateBulkInput,
    updateBulkScenario,
    updateQuotationInput,
    updateRetailInput,
    updateRetailScenario,
    removeBulkScenario,
  };
};
