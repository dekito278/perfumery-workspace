import React from 'react';
import { AlertTriangle, Droplets, Layers3, Package } from 'lucide-react';

const RawMaterialsSummaryCards = ({
  summaryLoading,
  totalMaterials,
  matchedReferenceCount,
  guidanceGapCount,
  solventCount,
  categoryCount,
  ifraReferenceCount,
  practicalMergeCandidateCount,
}) => (
  <div className="list-summary-grid list-summary-grid-4">
    <div className="list-summary-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="list-summary-label">Total materials</p>
          <span className="list-summary-value">{summaryLoading ? '...' : totalMaterials}</span>
          <p className="list-summary-note">{matchedReferenceCount} linked to workbook references.</p>
        </div>
        <Layers3 className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
    <div className="list-summary-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="list-summary-label">Guidance gaps</p>
          <span className="list-summary-value text-amber-700">{guidanceGapCount}</span>
          <p className="list-summary-note">Materials that still need reference signals.</p>
        </div>
        <AlertTriangle className="h-5 w-5 text-amber-700" />
      </div>
    </div>
    <div className="list-summary-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="list-summary-label">Solvents ready</p>
          <span className="list-summary-value">{solventCount}</span>
          <p className="list-summary-note">Solvents available for dilution-aware composition work.</p>
        </div>
        <Droplets className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
    <div className="list-summary-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="list-summary-label">Reference and audit</p>
          <span className="list-summary-value text-[1.45rem] sm:text-[1.7rem]">{categoryCount}</span>
          <p className="list-summary-note">{ifraReferenceCount} IFRA linked, {practicalMergeCandidateCount} merge candidates.</p>
        </div>
        <Package className="h-5 w-5 text-muted-foreground" />
      </div>
    </div>
  </div>
);

export default RawMaterialsSummaryCards;
