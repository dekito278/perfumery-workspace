import React from 'react';
import { formatCurrency, formatPercentage } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';

const cardClassName = 'rounded-xl border bg-card p-4';

const ProductionCostOverviewCards = ({ retailComputed, bulkComputed, retailChampion, bulkChampion }) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <div className={cardClassName}>
      <div className="text-xs text-muted-foreground">HPP retail / botol</div>
      <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatCurrency(retailComputed.costPerBottle)}</div>
      <div className="mt-2 text-xs text-muted-foreground">Semua biaya per botol jadi: bahan, kemasan, dan overhead.</div>
    </div>
    <div className={cardClassName}>
      <div className="text-xs text-muted-foreground">HPP curah / liter</div>
      <div className="mt-1 text-2xl font-bold font-mono">{formatCurrency(bulkComputed.allInBulkCogsPerLiter)}</div>
      <div className="mt-2 text-xs text-muted-foreground">Biaya cairan parfum untuk dijual curah ke brand, tanpa kemasan retail.</div>
    </div>
    <div className={cardClassName}>
      <div className="text-xs text-muted-foreground">Laba retail terbaik</div>
      <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatCurrency(retailChampion?.profitPerBottle || 0)}</div>
      <div className="mt-2 text-xs text-muted-foreground">{retailChampion?.label || 'Retail manual'} dengan margin {formatPercentage(retailChampion?.profitMargin || 0)}.</div>
    </div>
    <div className={cardClassName}>
      <div className="text-xs text-muted-foreground">Laba curah terbaik</div>
      <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatPrice(bulkChampion?.profit || 0)}</div>
      <div className="mt-2 text-xs text-muted-foreground">{bulkChampion?.label || 'Belum ada penawaran curah'} untuk satu paket.</div>
    </div>
  </div>
);

export default ProductionCostOverviewCards;
