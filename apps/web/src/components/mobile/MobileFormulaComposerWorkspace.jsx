import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Droplets,
  Link2,
  MoreHorizontal,
  Pause,
  PieChartIcon,
  Play,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import MobileAccordion from '@/components/mobile-ui/MobileAccordion.jsx';
import MobileBottomSheet from '@/components/mobile-ui/MobileBottomSheet.jsx';
import MobileFilterChips from '@/components/mobile-ui/MobileFilterChips.jsx';
import MobileSearchBar from '@/components/mobile-ui/MobileSearchBar.jsx';
import MobileSegmentedControl from '@/components/mobile-ui/MobileSegmentedControl.jsx';
import MobileStatusBadge from '@/components/mobile-ui/MobileStatusBadge.jsx';
import PaginationOrLoadMore from '@/components/mobile-ui/PaginationOrLoadMore.jsx';
import StickyBottomActionBar from '@/components/mobile-ui/StickyBottomActionBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { MOBILE_PAGE_SIZE, filterByText, getVisibleItems } from '@/pages/mobile/mobilePageUtils.js';
import { buildWorkbookSimulation, getFormulaItemDilutionFactor } from '@/utils/formulaWorkbookSimulation.js';
import { buildFormulaSensoryCharts } from '@/utils/formulaSensoryCharts.js';
import {
  buildFormulaInsight,
  createGuidanceSource,
  enrichCompositionItems,
  getDilutionLabel,
} from '@/utils/mobileFormulaInsights.js';
import {
  GUIDANCE_SOURCE_OPTIONS,
  importGuidanceBySource,
  summarizeImportedGuidance,
} from '@/utils/mobileGuidanceImport.js';
import { getResolvedGuidanceNumber, getResolvedGuidanceValues } from '@/utils/mobileRawMaterialGuidance.js';

const COMPOSER_PAGE_SIZE = 5;
const FINDER_RESULT_SIZE = 3;

const tabs = [
  { value: 'composition', label: 'Composition' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'workbook', label: 'Workbook' },
  { value: 'materials', label: 'Materials' },
];

const materialFilters = [
  { value: 'all', label: 'All' },
  { value: 'has_guidance', label: 'Guided' },
  { value: 'no_guidance', label: 'Needs Guidance' },
  { value: 'high_impact', label: 'High Impact' },
  { value: 'missing', label: 'Missing Data' },
];

const mediumOptions = [
  { value: 'DPG', label: 'DPG' },
  { value: 'Alcohol', label: 'Alcohol' },
  { value: 'TEC', label: 'TEC' },
  { value: 'Other', label: 'Other' },
];

const dilutionPresets = [
  { value: 'neat', label: 'Neat 100%', concentration: '100', medium: 'DPG' },
  { value: 'dpg10', label: '10% in DPG', concentration: '10', medium: 'DPG' },
  { value: 'dpg1', label: '1% in DPG', concentration: '1', medium: 'DPG' },
  { value: 'alcohol10', label: '10% in Alcohol', concentration: '10', medium: 'Alcohol' },
  { value: 'custom', label: 'Custom', concentration: '', medium: 'DPG' },
];

const formatPercent = (value, digits = 1) => `${Number(value || 0).toFixed(digits)}%`;
const formatGram = (value, digits = 2) => `${Number(value || 0).toFixed(digits)}g`;
const compactValue = (value) => Number(value || 0).toFixed(Number(value || 0) >= 10 ? 1 : 2);
const formatMetricNumber = (value, digits = 1) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return Number(number.toFixed(digits)).toString();
};

const MetricPill = ({ label, value, tone = 'slate', helper }) => (
  <div className={`rounded-xl border p-2 ${tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
    <div className="text-[10px] font-bold uppercase text-[#8a9099]">{label}</div>
    <div className="mt-0.5 text-sm font-bold text-[#1f2937]">{value}</div>
    {helper ? <div className="mt-0.5 text-[10px] font-semibold text-[#6b7280]">{helper}</div> : null}
  </div>
);

const MiniWorkbookRows = ({ rows = [], empty = 'No chart data' }) => {
  const visibleRows = rows.filter((entry) => Number(entry.value || entry.percent || 0) > 0).slice(0, 6);
  if (!visibleRows.length) {
    return <div className="rounded-xl bg-[#f8f7f4] p-2 text-[11px] font-semibold text-[#6b7280]">{empty}</div>;
  }

  return (
    <div className="space-y-1.5">
      {visibleRows.map((entry) => {
        const value = Number(entry.value ?? entry.percent ?? 0);
        return (
          <div key={entry.key || entry.label || entry.family || entry.facet} className="grid grid-cols-[72px_1fr_34px] items-center gap-2 text-[11px] font-semibold">
            <span className="truncate text-[#374151]">{entry.label || entry.family || entry.facet}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[#ece8df]">
              <span className="block h-full rounded-full bg-amber-500" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
            </span>
            <span className="text-right text-[#6b7280]">{Math.round(value)}</span>
          </div>
        );
      })}
    </div>
  );
};

const buildWorkbookClassRows = (rows = []) => {
  const totals = new Map();
  rows.forEach((row) => {
    const rowWeight = Number(row.odourWeight || 0);
    if (!rowWeight) return;
    (row.classDistribution || []).forEach((entry) => {
      const key = entry.letter || entry.familyName || entry.classIndex;
      if (!key) return;
      const current = totals.get(key) || {
        key,
        label: entry.letter ? `${entry.letter} ${entry.familyName || ''}`.trim() : entry.familyName || `Class ${entry.classIndex}`,
        value: 0,
      };
      current.value += (rowWeight * Number(entry.share || 0)) / 100;
      totals.set(key, current);
    });
  });

  const total = [...totals.values()].reduce((sum, entry) => sum + entry.value, 0);
  return [...totals.values()]
    .map((entry) => ({ ...entry, value: total > 0 ? (entry.value / total) * 100 : 0 }))
    .sort((left, right) => right.value - left.value);
};

const SectionTitle = ({ title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-2">
    <div>
      <h2 className="text-sm font-bold text-[#1f2937]">{title}</h2>
      {subtitle ? <p className="mt-0.5 text-[11px] font-medium text-[#6b7280]">{subtitle}</p> : null}
    </div>
    {action}
  </div>
);

const buildConicGradient = (rows = []) => {
  let cursor = 0;
  const segments = rows.map((row) => {
    const value = Math.max(Number(row.percent || 0), 0);
    const start = cursor;
    const end = Math.min(cursor + value, 100);
    cursor = end;
    return `${row.color || '#d8d5cf'} ${start}% ${end}%`;
  });

  return segments.length ? `conic-gradient(${segments.join(', ')}, #ece8df ${cursor}% 100%)` : '#ece8df';
};

const CompactWorkbookPreview = ({ items, rawMaterialsById, referenceLinksMap }) => {
  const [mode, setMode] = useState('pie');
  const [elapsedHour, setElapsedHour] = useState(0);
  const [playing, setPlaying] = useState(false);
  const charts = useMemo(() => buildFormulaSensoryCharts({
    items,
    rawMaterialsById,
    referenceLinksMap,
  }), [items, rawMaterialsById, referenceLinksMap]);
  const maxHour = Math.max(Math.round(Number(charts.maxElapsedHour || 0)), 0);
  const roundedHour = Math.min(Math.max(Math.round(Number(elapsedHour) || 0), 0), maxHour);
  const rows = (charts.classDistributionTimeline?.[roundedHour]?.classes || charts.classDistributionData || [])
    .filter((entry) => Number(entry.percent || 0) > 0)
    .slice(0, 7);
  const dominant = rows[0] || charts.dominantClass || null;

  useEffect(() => {
    setElapsedHour((current) => Math.min(current, maxHour));
  }, [maxHour]);

  useEffect(() => {
    if (!playing || !maxHour) return undefined;
    const interval = window.setInterval(() => {
      setElapsedHour((current) => {
        if (current >= maxHour) {
          setPlaying(false);
          return 0;
        }
        return current + 1;
      });
    }, 320);
    return () => window.clearInterval(interval);
  }, [maxHour, playing]);

  return (
    <div className="rounded-2xl border border-[#ded6c8] bg-[#fffdf8] p-3" data-testid="compact-live-workbook-preview">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase text-[#8a744d]">Graphic odour</div>
          <div className="truncate text-xs font-bold text-[#1f2937]">{dominant?.familyName || 'No class data'}</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode('pie')}
            className={`grid h-8 w-8 place-items-center rounded-xl border ${mode === 'pie' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-[#e5e7eb] bg-white text-[#6b7280]'}`}
            aria-label="Pie chart"
          >
            <PieChartIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setMode('bar')}
            className={`grid h-8 w-8 place-items-center rounded-xl border ${mode === 'bar' ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-[#e5e7eb] bg-white text-[#6b7280]'}`}
            aria-label="Bar chart"
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((current) => !current)}
            disabled={!maxHour || !rows.length}
            className="grid h-8 min-h-8 w-8 place-items-center rounded-xl bg-amber-500 text-white disabled:bg-[#d8d5cf]"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[112px_1fr] gap-3">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[#eee7d8] bg-[#fbf7ec] p-2">
          {mode === 'pie' ? (
            <div
              className="h-[88px] w-[88px] rounded-full border border-[#b8af9e]"
              style={{ background: buildConicGradient(rows) }}
              data-testid="compact-odour-pie"
            />
          ) : (
            <div className="flex h-[88px] w-full items-end gap-1.5 px-1" data-testid="compact-odour-bar">
              {rows.slice(0, 6).map((entry) => (
                <span
                  key={entry.classIndex || entry.letter || entry.familyName}
                  className="min-h-[8px] flex-1 rounded-t-md"
                  style={{
                    height: `${Math.max(Math.min(Number(entry.percent || 0), 100), 8)}%`,
                    backgroundColor: entry.color || '#d8d5cf',
                  }}
                  title={entry.familyName}
                />
              ))}
            </div>
          )}
          <div className="mt-2 text-[10px] font-bold text-[#6b7280]">
            {roundedHour}h / {maxHour || 0}h
          </div>
        </div>

        <div className="min-w-0 space-y-1.5">
          {rows.length ? rows.slice(0, 5).map((entry) => (
            <div key={entry.classIndex || entry.letter || entry.familyName} className="grid grid-cols-[18px_1fr_30px] items-center gap-1.5 text-[10px] font-bold">
              <span className="grid h-4 w-4 place-items-center rounded border border-[#d8d5cf] bg-white text-[8px] text-[#403522]">{entry.letter || '?'}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-[#ece8df]">
                <span className="block h-full rounded-full" style={{ width: `${Math.min(Number(entry.percent || 0), 100)}%`, backgroundColor: entry.color || '#d8d5cf' }} />
              </span>
              <span className="text-right text-[#6b7280]">{Math.round(Number(entry.percent || 0))}</span>
            </div>
          )) : (
            <div className="rounded-xl bg-[#f8f7f4] p-2 text-[11px] font-semibold text-[#6b7280]">No workbook data</div>
          )}
        </div>
      </div>
    </div>
  );
};

const matchesMaterialFilter = (material, filter) => {
  const resolved = getResolvedGuidanceValues(material);
  const impact = getResolvedGuidanceNumber(material, 'reference_impact');
  const life = getResolvedGuidanceNumber(material, 'reference_life_hours');
  const hasGuidance = Boolean(resolved.workbook_code || impact || life || resolved.ifra_limit);
  if (filter === 'has_guidance') return hasGuidance;
  if (filter === 'no_guidance') return !hasGuidance;
  if (filter === 'high_impact') return Number(impact || 0) >= 7;
  if (filter === 'missing') return !impact || !life;
  return true;
};

const getOdorTag = (material = {}) =>
  getResolvedGuidanceValues(material).reference_abc_primary_family
  || material.category
  || material.reference_abc_secondary_family
  || 'Uncategorized';

const getMaterialImpactLabel = (material = {}) => {
  const impact = Number(getResolvedGuidanceNumber(material, 'reference_impact') || material.impact_value || 0);
  if (!impact) return '';
  if (impact >= 75) return 'High impact';
  if (impact >= 45) return 'Medium impact';
  return 'Low impact';
};

const useHorizontalDragScroll = () => {
  const ref = useRef(null);
  const drag = useRef({ active: false, x: 0, left: 0, moved: false });

  const handlers = {
    onPointerDown: (event) => {
      if (!ref.current) return;
      drag.current = {
        active: true,
        x: event.clientX,
        left: ref.current.scrollLeft,
        moved: false,
      };
      ref.current.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!drag.current.active || !ref.current) return;
      const delta = event.clientX - drag.current.x;
      if (Math.abs(delta) > 4) {
        drag.current.moved = true;
        ref.current.scrollLeft = drag.current.left - delta;
      }
    },
    onPointerUp: (event) => {
      ref.current?.releasePointerCapture?.(event.pointerId);
      drag.current.active = false;
    },
    onPointerCancel: () => {
      drag.current.active = false;
    },
    onClickCapture: (event) => {
      if (drag.current.moved) {
        event.preventDefault();
        event.stopPropagation();
        drag.current.moved = false;
      }
    },
  };

  return [ref, handlers];
};

const MaterialSuggestion = ({ material, onAdd }) => (
  <article className="min-h-[78px] rounded-2xl border border-[#e5e7eb] bg-white p-2.5 shadow-sm">
    <div className="flex min-h-[34px] items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="mobile-line-clamp-2 text-xs font-bold leading-snug text-[#1f2937]">{material.name}</h3>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-[#6b7280]">
          {material.cas_number ? `CAS ${material.cas_number}` : material.category || 'No CAS'}
        </p>
      </div>
      <Button type="button" onClick={() => onAdd(material)} className="h-7 rounded-lg px-2 text-[10px]">
        Add
      </Button>
    </div>
    <div className="mt-2 flex items-center gap-1 overflow-hidden">
      <span className="max-w-[120px] truncate rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-bold text-[#6b7280]">{getOdorTag(material)}</span>
      {getMaterialImpactLabel(material) ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{getMaterialImpactLabel(material)}</span> : null}
    </div>
  </article>
);

const MobileFormulaComposerWorkspace = ({
  mode = 'create',
  metadata,
  rawMaterials,
  items,
  onUpdateItem,
  onRemoveItem,
  onAddMaterial,
  onOpenMetadata,
  onSave,
  saveLabel,
  saveDisabled,
  saving,
  showActionBar = true,
  onOverlayOpenChange,
}) => {
  const [tab, setTab] = useState('composition');
  const [expandedRow, setExpandedRow] = useState('');
  const [compositionVisible, setCompositionVisible] = useState(COMPOSER_PAGE_SIZE);
  const [materialsVisible, setMaterialsVisible] = useState(COMPOSER_PAGE_SIZE);
  const [finderQuery, setFinderQuery] = useState('');
  const [materialQuery, setMaterialQuery] = useState('');
  const [materialFilter, setMaterialFilter] = useState('all');
  const [dilutionItem, setDilutionItem] = useState(null);
  const [dilutionDraft, setDilutionDraft] = useState({ preset: 'neat', medium: 'DPG', concentration: '100' });
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [guidanceState, setGuidanceState] = useState('empty');
  const [guidanceSources, setGuidanceSources] = useState([]);
  const [guidanceForm, setGuidanceForm] = useState({ url: '', sourceType: 'perfumersworld' });
  const [guidanceSummary, setGuidanceSummary] = useState([]);
  const [finderScrollRef, finderScrollHandlers] = useHorizontalDragScroll();

  useEffect(() => {
    onOverlayOpenChange?.(Boolean(dilutionItem) || guidanceOpen);
  }, [dilutionItem, guidanceOpen, onOverlayOpenChange]);

  const materialsById = useMemo(() => new Map(rawMaterials.map((material) => [material.id, material])), [rawMaterials]);
  const totalGrams = useMemo(() => items.reduce((sum, item) => sum + Number(item.gram_amount || item.grams || 0), 0), [items]);
  const composition = useMemo(() => enrichCompositionItems(items, totalGrams, materialsById), [items, materialsById, totalGrams]);
  const insight = useMemo(() => buildFormulaInsight(composition, guidanceSources), [composition, guidanceSources]);
  const workbookItems = useMemo(() => composition.map((item) => ({
    ...item,
    percentage: item.formulaPercent,
    grams: item.gram,
    gram_amount: item.gram,
    dilution_percent: getFormulaItemDilutionFactor(item) >= 0.9999 ? null : item.concentrationPercent,
  })), [composition]);
  const workbookReferenceLinksMap = useMemo(() => new Map(), []);
  const workbookSimulation = useMemo(() => buildWorkbookSimulation({
    items: workbookItems,
    rawMaterialsById: materialsById,
    referenceLinksMap: workbookReferenceLinksMap,
  }), [materialsById, workbookItems, workbookReferenceLinksMap]);
  const compositionIds = useMemo(() => new Set(items.map((item) => item.item_id)), [items]);

  const filteredMaterials = useMemo(() => {
    const searched = filterByText(rawMaterials, materialQuery, ['name', 'cas_number', 'category', 'reference_abc_primary_family']);
    const filtered = searched.filter((material) => matchesMaterialFilter(material, materialFilter));
    return filtered;
  }, [materialFilter, materialQuery, rawMaterials]);

  const finderMaterials = useMemo(() => {
    const hasQuery = finderQuery.trim().length > 0;
    const base = hasQuery
      ? filterByText(rawMaterials, finderQuery, ['name', 'cas_number', 'category', 'reference_abc_primary_family'])
      : rawMaterials;

    return base
      .filter((material) => !compositionIds.has(material.id))
      .slice(0, FINDER_RESULT_SIZE);
  }, [compositionIds, finderQuery, rawMaterials]);

  useEffect(() => {
    setCompositionVisible((current) => Math.max(COMPOSER_PAGE_SIZE, Math.min(current, Math.max(composition.length, COMPOSER_PAGE_SIZE))));
  }, [composition.length]);

  const handleAddMaterial = (material) => {
    onAddMaterial(material);
    setFinderQuery('');
    setTab('composition');
  };

  const setFormulaPercent = (item, value) => {
    const target = Number(value || 0);
    const otherTotal = Math.max(totalGrams - Number(item.gram_amount || 0), 0);
    const nextGram = target >= 100 ? otherTotal : (otherTotal * target) / Math.max(100 - target, 1);
    onUpdateItem(item.row_key, 'gram_amount', Number.isFinite(nextGram) ? nextGram.toFixed(3) : '0');
  };

  const openDilutionSheet = (item) => {
    const concentration = Number(item.concentration_percent || item.dilution_percent || item.concentrationPercent || 100);
    const preset = concentration >= 99.99
      ? 'neat'
      : concentration === 10 && (item.dilutionMedium || item.dilution_medium || 'DPG') === 'Alcohol'
        ? 'alcohol10'
        : concentration === 10
          ? 'dpg10'
          : concentration === 1
            ? 'dpg1'
            : 'custom';
    setDilutionItem(item);
    setDilutionDraft({
      preset,
      medium: item.dilutionMedium || item.dilution_medium || 'DPG',
      concentration: concentration >= 99.99 ? '100' : String(concentration || ''),
    });
  };

  const applyPreset = (presetValue) => {
    const preset = dilutionPresets.find((option) => option.value === presetValue);
    setDilutionDraft((current) => ({
      ...current,
      preset: presetValue,
      medium: preset?.medium || current.medium,
      concentration: preset?.concentration ?? current.concentration,
    }));
  };

  const applyDilution = () => {
    if (!dilutionItem) return;
    const concentration = dilutionDraft.preset === 'neat' ? '100' : dilutionDraft.concentration;
    const isNeat = Number(concentration || 0) >= 99.99;
    onUpdateItem(dilutionItem.row_key, 'dilution_type', isNeat ? 'neat' : dilutionDraft.preset === 'custom' ? 'custom' : 'solution');
    onUpdateItem(dilutionItem.row_key, 'dilution_medium', dilutionDraft.medium);
    onUpdateItem(dilutionItem.row_key, 'concentration_percent', isNeat ? '100' : concentration);
    onUpdateItem(dilutionItem.row_key, 'dilution_percent', isNeat ? '' : concentration);
    setDilutionItem(null);
    toast.success('Dilution updated');
  };

  const normalizeTo100 = () => {
    if (!totalGrams) return;
    toast.success('Formula normalized to 100% view');
  };

  const importGuidance = async () => {
    if (!guidanceForm.url.trim() || !/^https?:\/\//i.test(guidanceForm.url.trim())) {
      setGuidanceState('error');
      toast.error('Unable to import guidance');
      return;
    }
    setGuidanceState('loading');
    try {
      const imported = await importGuidanceBySource({
        sourceType: guidanceForm.sourceType,
        url: guidanceForm.url.trim(),
      });
      setGuidanceSources((current) => [createGuidanceSource({ ...guidanceForm, imported }), ...current]);
      setGuidanceSummary(summarizeImportedGuidance({ sourceType: guidanceForm.sourceType, imported }));
      setGuidanceForm({ url: '', sourceType: 'perfumersworld' });
      setGuidanceState('success');
      setGuidanceOpen(false);
      toast.success('Guidance imported and insights updated');
    } catch (error) {
      setGuidanceState('error');
      toast.error(error.message || 'Unable to import guidance');
    }
  };

  const dilutionPreviewConcentration = Number(dilutionDraft.preset === 'neat' ? 100 : dilutionDraft.concentration || 0);
  const dilutionPreviewGram = Number(dilutionItem?.gram || dilutionItem?.gram_amount || 0);
  const dilutionPreviewActive = (dilutionPreviewGram * dilutionPreviewConcentration) / 100;
  const visibleComposition = getVisibleItems(composition, compositionVisible);
  const visibleWarnings = [
    ...workbookSimulation.performanceWarnings.map((warning) => warning.message || warning.title).filter(Boolean),
    ...insight.warnings,
  ].slice(0, 3);
  const graphEntries = insight.odorProfileGraph.slice(0, 8);
  const workbookClassRows = useMemo(() => buildWorkbookClassRows(workbookSimulation.rows), [workbookSimulation.rows]);
  const impactDisplay = workbookSimulation.hasImpactData ? formatMetricNumber(workbookSimulation.impactEstimate, 1) : '-';
  const lifetimeHours = workbookSimulation.odourWeightedLifeHours ?? workbookSimulation.simpleLifeHours;
  const lifetimeDisplay = workbookSimulation.hasLifeData ? formatMetricNumber(lifetimeHours, 1) : '-';
  const lifetimeHelper = workbookSimulation.hasLifeData ? `${lifetimeDisplay} h` : 'No data';
  const impactTone = workbookSimulation.hasImpactData && Number(workbookSimulation.impactEstimate || 0) >= 75 ? 'amber' : 'slate';
  const topMiddleBaseDistribution = {
    top: workbookSimulation.topPercent || 0,
    middle: workbookSimulation.middlePercent || 0,
    base: workbookSimulation.basePercent || 0,
  };
  const dominantPhase = Object.entries(topMiddleBaseDistribution).sort((left, right) => right[1] - left[1])[0] || ['base', 0];
  const workbookBalanceStatus = !composition.length
    ? 'Needs adjustment'
    : dominantPhase[1] > 55
      ? `${dominantPhase[0][0].toUpperCase()}${dominantPhase[0].slice(1)}-heavy`
      : 'Balanced';
  const workbookRecommendation = workbookBalanceStatus === 'Balanced'
    ? 'Distribution is ready for validation.'
    : workbookBalanceStatus.includes('Base')
      ? 'Reduce heavy base materials or increase fresh top notes.'
      : workbookBalanceStatus.includes('Top')
        ? 'Add middle or base support for better persistence.'
        : 'Add more heart materials to support the transition.';

  return (
    <>
      <section className="mobile-soft-card mobile-compact-card p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase text-amber-700">{mode === 'edit' ? 'Edit formula' : 'New formula'}</p>
            <h1 className="mt-0.5 truncate text-base font-bold text-[#1f2937]">{metadata.name || 'Untitled formula'}</h1>
            <p className="truncate text-[11px] font-semibold text-[#6b7280]">{metadata.code || 'No code'} - {metadata.category || 'perfume'}</p>
          </div>
          <Button type="button" variant="outline" onClick={onOpenMetadata} className="h-8 rounded-xl bg-white px-3 text-[11px]">Metadata</Button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          <MetricPill label="Total" value={formatPercent(insight.totalPercent)} tone={Math.abs(insight.totalPercent - 100) > 0.25 ? 'amber' : 'emerald'} />
          <MetricPill label="Actual" value={formatGram(insight.totalActualActiveGrams)} helper={formatPercent(insight.totalActualActive)} />
          <MetricPill label="Impact" value={impactDisplay} helper={insight.impactLabel} />
          <MetricPill label="Life" value={lifetimeHelper} helper={workbookSimulation.hasLifeData ? 'Workbook hours' : 'No data'} />
        </div>
      </section>

      <MobileSegmentedControl options={tabs} value={tab} onChange={setTab} className="mobile-compact-tabs" />

      {tab === 'composition' ? (
        <section className="space-y-2 pb-24">
          <section className="mobile-card mobile-compact-card p-3">
            <SectionTitle
              title="Raw Material Finder"
              subtitle={finderQuery ? `${finderMaterials.length} matches` : undefined}
            />
            <div className="mt-2">
              <MobileSearchBar value={finderQuery} onChange={setFinderQuery} placeholder="Find raw material..." />
            </div>
            <div ref={finderScrollRef} className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1 mobile-horizontal-scroll mobile-segment-scroll" {...finderScrollHandlers}>
              {finderMaterials.length ? finderMaterials.map((material) => (
                <div key={material.id} className="w-[82%] max-w-[280px] shrink-0 snap-start">
                  <MaterialSuggestion material={material} onAdd={handleAddMaterial} />
                </div>
              )) : (
                <div className="w-full rounded-2xl border border-dashed border-[#d8d5cf] bg-[#faf9f6] p-3 text-xs font-semibold text-[#6b7280]">
                  No matching material. Try a broader name or open Materials.
                </div>
              )}
            </div>
          </section>

          <section className="mobile-card mobile-compact-card p-3">
            <SectionTitle
              title="Composition Board"
              subtitle={`${composition.length} materials - ${formatGram(insight.totalGrams)}`}
              action={<Button type="button" variant="outline" onClick={normalizeTo100} className="h-8 rounded-xl bg-white px-3 text-[11px]">Normalize</Button>}
            />
            <div className="mt-2 space-y-2">
              {visibleComposition.length ? visibleComposition.map((item) => {
                const open = expandedRow === item.row_key;
                const dilutionTone = item.dilutionLabel === 'Set dilution' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-[#e5e7eb] bg-white text-[#374151]';
                const hasSyncIssue = !item.hasGuidanceData || item.dilutionLabel === 'Set dilution';
                return (
                  <article key={item.row_key} className="rounded-2xl border border-[#e5e7eb] bg-white">
                    <div className="p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => setExpandedRow(open ? '' : item.row_key)} className="min-w-0 flex-1 text-left">
                          <h3 className="truncate text-sm font-bold text-[#1f2937]">{item.materialName}</h3>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-[#6b7280]">{item.category}</p>
                        </button>
                        <div className="flex items-center gap-1">
                          {hasSyncIssue ? <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-label="Workbook guidance needs sync" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                          <button type="button" onClick={() => setExpandedRow(open ? '' : item.row_key)} className="rounded-lg p-1 text-[#6b7280]"><MoreHorizontal className="h-4 w-4" /></button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5">
                        <Input value={item.gram_amount} inputMode="decimal" onChange={(event) => onUpdateItem(item.row_key, 'gram_amount', event.target.value)} className="h-8 rounded-xl bg-[#f8f7f4] px-2 text-xs font-bold" aria-label={`${item.materialName} gram`} />
                        <Input value={compactValue(item.formulaPercent)} inputMode="decimal" onChange={(event) => setFormulaPercent(item, event.target.value)} className="h-8 rounded-xl bg-[#f8f7f4] px-2 text-xs font-bold" aria-label={`${item.materialName} formula percent`} />
                        <div className="rounded-xl bg-[#f8f7f4] px-2 py-1 text-[10px] font-bold text-[#6b7280]">
                          Actual<br /><span className="text-[11px] text-[#1f2937]">{formatPercent(item.actualActivePercent)}</span>
                        </div>
                        <button type="button" onClick={() => openDilutionSheet(item)} className={`min-w-[78px] rounded-xl border px-2 py-1 text-[10px] font-bold ${dilutionTone}`}>
                          {item.dilutionLabel || getDilutionLabel(item)}
                        </button>
                      </div>
                    </div>
                    {open ? (
                      <div className="border-t border-[#e5e7eb] p-2.5">
                        <div className="grid grid-cols-[1fr_1fr_44px] gap-2">
                          <div className="rounded-xl bg-[#f8f7f4] p-2 text-[11px] font-semibold text-[#6b7280]">Active contribution<br /><span className="text-sm font-bold text-[#1f2937]">{formatGram(item.actualActiveGram)} / {formatPercent(item.actualActivePercent)}</span></div>
                          <button type="button" onClick={() => openDilutionSheet(item)} className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-left text-[11px] font-bold text-amber-800"><Droplets className="mb-1 h-3.5 w-3.5" />Concentrate<br /><span className="text-[10px]">{item.dilutionLabel}</span></button>
                          <Button type="button" variant="outline" size="icon" onClick={() => onRemoveItem(item.row_key)} className="h-full min-h-[54px] rounded-xl border-rose-200 bg-rose-50 text-rose-700" aria-label="Remove material"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-[#d8d5cf] bg-[#faf9f6] p-4 text-center">
                  <p className="text-sm font-bold text-[#1f2937]">No materials yet</p>
                </div>
              )}
            </div>
            <PaginationOrLoadMore visibleCount={Math.min(compositionVisible, composition.length)} totalCount={composition.length} onLoadMore={() => setCompositionVisible((current) => current + COMPOSER_PAGE_SIZE)} />
          </section>

          {showActionBar && !dilutionItem && !guidanceOpen ? <StickyBottomActionBar>
            <div className="grid grid-cols-[1fr_1fr_1.2fr] gap-2">
              <div className="rounded-xl bg-white px-2 py-1 text-[10px] font-bold text-[#6b7280]">Formula<br /><span className="text-xs text-[#1f2937]">{formatPercent(insight.totalPercent)}</span></div>
              <div className="rounded-xl bg-white px-2 py-1 text-[10px] font-bold text-[#6b7280]">Actual<br /><span className="text-xs text-[#1f2937]">{formatGram(insight.totalActualActiveGrams)}</span></div>
              <Button type="button" onClick={onSave} disabled={saveDisabled || saving} className="h-10 rounded-xl text-xs">{saving ? 'Saving...' : saveLabel}</Button>
            </div>
          </StickyBottomActionBar> : null}
        </section>
      ) : null}

      {tab === 'analysis' ? (
        <section className="space-y-2 pb-4">
          <section className="mobile-card mobile-compact-card p-3">
            <SectionTitle title="Odor Profile" action={<BarChart3 className="h-4 w-4 text-amber-700" />} />
            {graphEntries.some((entry) => entry.value > 0) ? (
              <>
                <div className="mt-3 grid gap-1.5">
                  {graphEntries.map((entry) => (
                    <div key={entry.key} className="grid grid-cols-[62px_1fr_34px] items-center gap-2 text-[11px] font-semibold">
                      <span>{entry.label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-[#ece8df]"><span className="block h-full rounded-full bg-amber-500" style={{ width: `${entry.value}%` }} /></span>
                      <span className="text-right">{Math.round(entry.value)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {insight.dominantNotes.map((entry) => <span key={entry.key} className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">{entry.label}</span>)}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-2xl border border-dashed border-[#d8d5cf] bg-[#faf9f6] p-3 text-xs text-[#6b7280]">
                <p className="font-bold text-[#1f2937]">No odor profile yet</p>
              </div>
            )}
          </section>

          <div className="grid grid-cols-2 gap-2">
            <MetricPill label="Impact" value={impactDisplay} helper={insight.impactLabel} tone={impactTone} />
            <MetricPill label="Lifetime" value={lifetimeHelper} helper={workbookSimulation.hasLifeData ? 'Workbook hours' : 'No data'} tone="emerald" />
          </div>

          <section className="mobile-card mobile-compact-card p-3">
            <SectionTitle title="Balance Preview" subtitle={`${formatPercent(topMiddleBaseDistribution.top, 0)} top - ${formatPercent(topMiddleBaseDistribution.middle, 0)} middle - ${formatPercent(topMiddleBaseDistribution.base, 0)} base`} />
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#ece8df]">
              <div className="inline-block h-full bg-amber-300" style={{ width: `${topMiddleBaseDistribution.top}%` }} />
              <div className="inline-block h-full bg-amber-500" style={{ width: `${topMiddleBaseDistribution.middle}%` }} />
              <div className="inline-block h-full bg-stone-700" style={{ width: `${topMiddleBaseDistribution.base}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {Object.entries(topMiddleBaseDistribution).map(([key, value]) => <MetricPill key={key} label={key} value={formatPercent(value, 0)} />)}
            </div>
            <div className={`mt-2 rounded-xl p-2 text-xs font-semibold ${workbookBalanceStatus === 'Balanced' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {workbookBalanceStatus}: {workbookRecommendation}
            </div>
          </section>

          <section className="mobile-card mobile-compact-card p-3">
            <SectionTitle title="Live Workbook Preview" />
            <div className="mt-3">
              <CompactWorkbookPreview
                items={workbookItems}
                rawMaterialsById={materialsById}
                referenceLinksMap={workbookReferenceLinksMap}
              />
            </div>
          </section>

          <section className="mobile-card mobile-compact-card p-3">
            <SectionTitle title="Recommendations" subtitle={`${workbookSimulation.warningCount + insight.warnings.length} active`} />
            <div className="mt-2 space-y-1">
              {visibleWarnings.length ? visibleWarnings.map((warning) => (
                <div key={warning} className="rounded-xl bg-amber-50 p-2 text-xs font-semibold text-amber-800">{warning}</div>
              )) : <div className="rounded-xl bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">No active warnings.</div>}
              {workbookSimulation.warningCount + insight.warnings.length > 3 ? <div className="text-[11px] font-bold text-[#6b7280]">View all {workbookSimulation.warningCount + insight.warnings.length} warnings in workbook.</div> : null}
            </div>
          </section>
        </section>
      ) : null}

      {tab === 'workbook' ? (
        <section className="space-y-2 pb-4">
          <MobileAccordion title="Metadata" meta={`${metadata.code || 'No code'} - ${metadata.status || 'draft'}`} defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <MetricPill label="Name" value={metadata.name || 'Untitled'} />
              <MetricPill label="Version" value={metadata.version || 'Draft'} />
              <MetricPill label="Category" value={metadata.category || 'Perfume'} />
              <MetricPill label="Mode" value={mode === 'edit' ? 'Edit' : 'Create'} />
            </div>
          </MobileAccordion>
          <MobileAccordion title="Composition" meta={`${composition.length} materials`}>
            {composition.slice(0, COMPOSER_PAGE_SIZE).map((item) => <div key={item.row_key} className="mb-1 rounded-xl bg-[#f8f7f4] p-2 text-xs font-semibold">{item.materialName} - {formatGram(item.gram)} - {formatPercent(item.formulaPercent)}</div>)}
          </MobileAccordion>
          <MobileAccordion title="Actuals" meta={formatGram(insight.totalActualActiveGrams)}>
            {composition.slice(0, COMPOSER_PAGE_SIZE).map((item) => <div key={item.row_key} className="mb-1 rounded-xl bg-[#f8f7f4] p-2 text-xs font-semibold">{item.materialName} - {item.dilutionLabel} - actual {formatGram(item.actualActiveGram)}</div>)}
          </MobileAccordion>
          <MobileAccordion title="Odor Profile" meta={insight.dominantNotes.map((entry) => entry.label).join(' / ') || 'No profile'} defaultOpen>
            {graphEntries.filter((entry) => entry.value > 0).length ? graphEntries.filter((entry) => entry.value > 0).map((entry) => <div key={entry.key} className="mb-1 rounded-xl bg-[#f8f7f4] p-2 text-xs font-semibold">{entry.label}: {Math.round(entry.value)}</div>) : <div className="rounded-xl bg-[#f8f7f4] p-2 text-xs font-semibold text-[#6b7280]">No odor profile yet</div>}
          </MobileAccordion>
          <MobileAccordion title="Impact & Lifetime" meta={`${impactDisplay} / ${lifetimeHelper}`} defaultOpen>
            <div className="grid grid-cols-2 gap-2">
              <MetricPill label="Impact" value={impactDisplay} helper={insight.impactLabel} />
              <MetricPill label="Lifetime" value={lifetimeDisplay} helper={lifetimeHelper} />
            </div>
          </MobileAccordion>
          <MobileAccordion title="Validation" meta={insight.balanceStatus}>
            <div className="space-y-1">
              {(insight.warnings.length ? insight.warnings : [metadata.notes || 'No note.']).slice(0, COMPOSER_PAGE_SIZE).map((entry) => <div key={entry} className="rounded-xl bg-[#f8f7f4] p-2 text-xs font-semibold text-[#6b7280]">{entry}</div>)}
            </div>
          </MobileAccordion>
        </section>
      ) : null}

      {tab === 'materials' ? (
        <section className="space-y-2 pb-4">
          <section className="mobile-card mobile-compact-card p-3">
            <SectionTitle
              title="Materials"
              action={<Button type="button" variant="outline" onClick={() => setGuidanceOpen(true)} className="h-8 rounded-xl bg-white px-3 text-[11px]"><Link2 className="mr-1 h-3.5 w-3.5" />Import</Button>}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setGuidanceOpen(true)} className="h-9 rounded-xl bg-white text-xs"><Link2 className="mr-1 h-3.5 w-3.5" />Import Guidance</Button>
              <Button type="button" variant="outline" onClick={() => setTab('analysis')} className="h-9 rounded-xl bg-white text-xs">Review Guidance</Button>
            </div>
          </section>
          <section className="mobile-card mobile-compact-card p-3">
            <MobileSearchBar value={materialQuery} onChange={setMaterialQuery} placeholder="Search material..." />
            <MobileFilterChips options={materialFilters} value={materialFilter} onChange={setMaterialFilter} />
          </section>
          <section className="mobile-card mobile-compact-card p-3">
            <SectionTitle title="Guidance Status" subtitle={guidanceSources.length ? 'Imported' : 'Not connected'} />
            <div className="mt-2 rounded-xl bg-[#f8f7f4] p-2 text-xs font-semibold text-[#6b7280]">
              {guidanceSources.length ? `${guidanceSources.length} source connected` : 'No guidance connected'}
            </div>
          </section>
          <section className="mobile-card mobile-compact-card p-3">
            <SectionTitle title="Material Results" subtitle={`${filteredMaterials.length} materials`} />
            <div className="mt-2 grid gap-2">
              {getVisibleItems(filteredMaterials, materialsVisible).map((material) => (
                <MaterialSuggestion key={material.id} material={material} onAdd={handleAddMaterial} />
              ))}
            </div>
          </section>
          <PaginationOrLoadMore visibleCount={Math.min(materialsVisible, filteredMaterials.length)} totalCount={filteredMaterials.length} onLoadMore={() => setMaterialsVisible((current) => current + COMPOSER_PAGE_SIZE)} />
        </section>
      ) : null}

      <MobileBottomSheet
        open={Boolean(dilutionItem)}
        onOpenChange={(open) => !open && setDilutionItem(null)}
        title="Dilution Setup"
        description={dilutionItem?.materialName}
        footer={(
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => setDilutionItem(null)} className="h-10 rounded-xl bg-white text-xs">Cancel</Button>
            <Button type="button" onClick={applyDilution} className="h-10 rounded-xl text-xs">Apply</Button>
          </div>
        )}
      >
        <div className="grid gap-3 pb-2">
          <div className="grid grid-cols-2 gap-2">
            {dilutionPresets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => applyPreset(preset.value)}
                className={`rounded-2xl border p-3 text-left text-xs font-bold ${dilutionDraft.preset === preset.value ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-[#e5e7eb] bg-white text-[#374151]'}`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {dilutionDraft.preset === 'custom' ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Medium</Label>
                <MobileSegmentedControl options={mediumOptions} value={dilutionDraft.medium} onChange={(medium) => setDilutionDraft((current) => ({ ...current, medium }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Concentration %</Label>
                <Input value={dilutionDraft.concentration} inputMode="decimal" onChange={(event) => setDilutionDraft((current) => ({ ...current, concentration: event.target.value }))} className="h-10 rounded-xl bg-white text-xs" />
              </div>
            </>
          ) : null}
          <div className="rounded-2xl bg-[#f8f7f4] p-3">
            <div className="grid grid-cols-2 gap-2">
              <MetricPill label="Active contribution" value={formatGram(dilutionPreviewActive)} helper={formatPercent((dilutionPreviewActive / Math.max(insight.totalGrams, 1)) * 100)} tone={dilutionPreviewConcentration ? 'emerald' : 'amber'} />
              <MetricPill label="Concentrate" value={formatPercent(dilutionPreviewConcentration)} helper={`${formatGram(dilutionPreviewGram)} solution`} />
            </div>
          </div>
        </div>
      </MobileBottomSheet>

      <MobileBottomSheet
        open={guidanceOpen}
        onOpenChange={setGuidanceOpen}
        title="Import Guidance URL"
        footer={<Button type="button" onClick={importGuidance} disabled={guidanceState === 'loading'} className="h-10 w-full rounded-xl text-xs">{guidanceState === 'loading' ? 'Importing guidance...' : 'Import Guidance'}</Button>}
      >
        <div className="grid gap-3 pb-2">
          <div className="space-y-1"><Label className="text-xs">URL</Label><Input value={guidanceForm.url} onChange={(event) => setGuidanceForm((current) => ({ ...current, url: event.target.value }))} placeholder="https://..." className="h-10 rounded-xl bg-white text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Source</Label><MobileSegmentedControl options={GUIDANCE_SOURCE_OPTIONS} value={guidanceForm.sourceType} onChange={(sourceType) => setGuidanceForm((current) => ({ ...current, sourceType }))} /></div>
          {guidanceSummary.length ? <div className="rounded-xl bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">{guidanceSummary.slice(0, 3).join(' · ')}</div> : null}
          {guidanceState === 'error' ? <div className="rounded-xl bg-rose-50 p-2 text-xs font-semibold text-rose-700">Unable to import guidance.</div> : null}
          {guidanceState === 'success' ? <div className="rounded-xl bg-emerald-50 p-2 text-xs font-semibold text-emerald-700">Guidance imported and insights updated.</div> : null}
        </div>
      </MobileBottomSheet>
    </>
  );
};

export default MobileFormulaComposerWorkspace;
