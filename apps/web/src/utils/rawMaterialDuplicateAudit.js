import {
  buildRawMaterialNameCandidates,
  buildRawMaterialSemanticLookupKey,
  collapseRawMaterialLookupValue,
  normalizeRawMaterialCasValue,
  normalizeRawMaterialLookupValue,
  rawMaterialHasDilutionMarker,
} from '@/services/rawMaterialsService.js';

const INVALID_CAS_VALUES = new Set(['', 'mixture', 'mix', 'na', 'n/a', 'unknown', 'odiferousmixture']);

const uniqueNonEmpty = (values) => [...new Set(
  (values || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
)];

const scoreGuidance = (material) => (
  (Number(material.reference_impact) > 0 ? 1 : 0)
  + (Number(material.reference_life_hours) > 0 ? 1 : 0)
  + (Number(material.ifra_limit) > 0 ? 1 : 0)
  + (material.cas_number ? 1 : 0)
  + (material.workbook_code ? 1 : 0)
);

const pickPreferredMaster = (materials) => (
  [...materials].sort((left, right) => {
    const scoreDelta = scoreGuidance(right) - scoreGuidance(left);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return String(left.name || '').localeCompare(String(right.name || ''));
  })[0]
);

const formatCas = (value) => String(value || '').trim();

const buildCollapsedNameGroups = (materials) => {
  const groups = new Map();

  for (const material of materials) {
    const key = buildRawMaterialSemanticLookupKey(material.name) || collapseRawMaterialLookupValue(material.name);
    if (!key) {
      continue;
    }

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(material);
  }

  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => {
      const sortedItems = [...items].sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
      const master = pickPreferredMaster(sortedItems);

      return {
        id: `collapsed:${key}`,
        key,
        type: 'collapsed-name',
        label: master.name || sortedItems[0]?.name || key,
        master,
        duplicates: sortedItems.filter((item) => item.id !== master.id),
        materials: sortedItems,
        reason: 'Nama hanya berbeda format penulisan, tanda baca, atau notasi kimia yang setara.',
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
};

const buildSlashAliasCandidates = (materials) => {
  const primaryNameMap = new Map();
  for (const material of materials) {
    const primaryKey = buildRawMaterialSemanticLookupKey(material.name) || collapseRawMaterialLookupValue(material.name);
    if (!primaryKey) {
      continue;
    }

    if (!primaryNameMap.has(primaryKey)) {
      primaryNameMap.set(primaryKey, []);
    }
    primaryNameMap.get(primaryKey).push(material);
  }

  const candidateMap = new Map();
  for (const material of materials) {
    const aliases = buildRawMaterialNameCandidates({
      name: material.name,
      notes: material.notes,
    });

    if (aliases.length <= 1) {
      continue;
    }

    const sourceIsDilution = rawMaterialHasDilutionMarker(material.name);
    for (const alias of aliases) {
      const aliasKey = buildRawMaterialSemanticLookupKey(alias) || collapseRawMaterialLookupValue(alias);
      const materialPrimaryKey = buildRawMaterialSemanticLookupKey(material.name) || collapseRawMaterialLookupValue(material.name);
      if (!aliasKey || aliasKey === materialPrimaryKey) {
        continue;
      }

      const targets = (primaryNameMap.get(aliasKey) || []).filter((candidate) => (
        candidate.id !== material.id
        && rawMaterialHasDilutionMarker(candidate.name) === sourceIsDilution
      ));

      if (!targets.length) {
        continue;
      }

      const target = pickPreferredMaster(targets);
      const sourceAliases = buildRawMaterialNameCandidates({
        name: material.name,
        notes: material.notes,
      });
      const id = `alias:${material.id}:${target.id}:${aliasKey}`;
      candidateMap.set(id, {
        id,
        type: 'alias-match',
        alias,
        source: material,
        target,
        sourceAliases,
        reason: 'Nama mengandung alias atau sinonim yang sudah ada sebagai raw material terpisah.',
      });
    }
  }

  return [...candidateMap.values()].sort((left, right) => left.source.name.localeCompare(right.source.name));
};

const buildCasGroups = (materials) => {
  const groups = new Map();

  for (const material of materials) {
    const normalizedCas = normalizeRawMaterialCasValue(material.cas_number);
    if (!normalizedCas || INVALID_CAS_VALUES.has(normalizedCas)) {
      continue;
    }

    if (!groups.has(normalizedCas)) {
      groups.set(normalizedCas, []);
    }
    groups.get(normalizedCas).push(material);
  }

  return [...groups.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([casKey, items]) => {
      const sortedItems = [...items].sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
      const collapsedNames = new Set(sortedItems.map((item) => buildRawMaterialSemanticLookupKey(item.name) || collapseRawMaterialLookupValue(item.name)));
      const dilutionKinds = new Set(sortedItems.map((item) => rawMaterialHasDilutionMarker(item.name)));

      let classification = 'keep-separate';
      let reason = 'CAS sama, tetapi nama menunjukkan varian atau material berbeda.';

      if (collapsedNames.size === 1) {
        classification = 'worth-review';
        reason = 'CAS dan nama ter-normalisasi sama. Kandidat merge manual paling kuat.';
      } else if (dilutionKinds.size === 1 && sortedItems.length === 2) {
        const [left, right] = sortedItems;
        const leftTokens = new Set(normalizeRawMaterialLookupValue(left.name).split(' ').filter(Boolean));
        const rightTokens = new Set(normalizeRawMaterialLookupValue(right.name).split(' ').filter(Boolean));
        const sharedTokenCount = [...leftTokens].filter((token) => rightTokens.has(token)).length;

        if (sharedTokenCount >= Math.min(leftTokens.size, rightTokens.size) - 1) {
          classification = 'worth-review';
          reason = 'CAS sama dan nama sangat mirip. Perlu review manual apakah ini alias atau grade berbeda.';
        }
      }

      return {
        id: `cas:${casKey}`,
        casKey,
        casNumber: formatCas(sortedItems[0]?.cas_number),
        type: 'cas-group',
        classification,
        reason,
        materials: sortedItems,
      };
    })
    .sort((left, right) => left.casNumber.localeCompare(right.casNumber));
};

const buildPracticalMergeCandidates = ({ collapsedNameGroups, slashAliasCandidates }) => {
  const candidates = [
    ...collapsedNameGroups.flatMap((group) => group.duplicates.map((duplicate) => ({
      id: `practical:${group.master.id}:${duplicate.id}`,
      type: 'collapsed-group',
      confidence: 'high',
      master: group.master,
      duplicate,
      reason: group.reason,
      actionLabel: 'Merge now',
      synonymNames: uniqueNonEmpty(group.materials.map((material) => material.name)),
      note: 'Aman untuk merge karena nama hanya beda format penulisan.',
    }))),
    ...slashAliasCandidates.map((candidate) => ({
      id: `practical:${candidate.target.id}:${candidate.source.id}`,
      type: 'alias-pair',
      confidence: 'medium',
      master: candidate.target,
      duplicate: candidate.source,
      reason: candidate.reason,
      actionLabel: 'Review then merge',
      synonymNames: uniqueNonEmpty([
        candidate.target.name,
        candidate.source.name,
        candidate.alias,
        ...(candidate.sourceAliases || []),
      ]),
      note: `Sinonim terdeteksi lewat alias "${candidate.alias}".`,
    })),
  ];

  return candidates.sort((left, right) => {
    if (left.confidence !== right.confidence) {
      return left.confidence === 'high' ? -1 : 1;
    }

    return String(left.master?.name || '').localeCompare(String(right.master?.name || ''));
  });
};

export const buildRawMaterialDuplicateAudit = (materials) => {
  const rows = Array.isArray(materials) ? materials.filter(Boolean) : [];
  const collapsedNameGroups = buildCollapsedNameGroups(rows);
  const slashAliasCandidates = buildSlashAliasCandidates(rows);
  const casGroups = buildCasGroups(rows);
  const reviewGroups = casGroups.filter((group) => group.classification === 'worth-review');
  const keepSeparateGroups = casGroups.filter((group) => group.classification === 'keep-separate');
  const practicalMergeCandidates = buildPracticalMergeCandidates({
    collapsedNameGroups,
    slashAliasCandidates,
  });

  return {
    summary: {
      materialCount: rows.length,
      collapsedNameGroupCount: collapsedNameGroups.length,
      slashAliasCandidateCount: slashAliasCandidates.length,
      reviewGroupCount: reviewGroups.length,
      keepSeparateGroupCount: keepSeparateGroups.length,
      practicalMergeCandidateCount: practicalMergeCandidates.length,
    },
    practicalMergeCandidates,
    collapsedNameGroups,
    slashAliasCandidates,
    reviewGroups,
    keepSeparateGroups,
  };
};
