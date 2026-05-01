import React from 'react';
import { formatCurrency, formatPercentage } from '@/utils/formatting.js';
import { formatPrice } from '@/utils/pricingUtils.js';

const cardClassName = 'rounded-xl border bg-card p-4';

const ProductionCostOverviewCards = ({ retailComputed, bulkComputed, retailChampion, bulkChampion }) => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <div className={cardClassName}>
      <div className="text-xs text-muted-foreground">Retail COGS / bottle</div>
      <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatCurrency(retailComputed.costPerBottle)}</div>
      <div className="mt-2 text-xs text-muted-foreground">Finished product all-in cost after materials, packaging, and overhead.</div>
    </div>
    <div className={cardClassName}>
      <div className="text-xs text-muted-foreground">Bulk COGS / liter</div>
      <div className="mt-1 text-2xl font-bold font-mono">{formatCurrency(bulkComputed.allInBulkCogsPerLiter)}</div>
      <div className="mt-2 text-xs text-muted-foreground">Juice cost for perfumer-to-brand sales, without retail packaging.</div>
    </div>
    <div className={cardClassName}>
      <div className="text-xs text-muted-foreground">Best retail profit</div>
      <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatCurrency(retailChampion?.profitPerBottle || 0)}</div>
      <div className="mt-2 text-xs text-muted-foreground">{retailChampion?.label || 'Manual retail'} at margin {formatPercentage(retailChampion?.profitMargin || 0)}.</div>
    </div>
    <div className={cardClassName}>
      <div className="text-xs text-muted-foreground">Best bulk profit</div>
      <div className="mt-1 text-2xl font-bold font-mono text-primary">{formatPrice(bulkChampion?.profit || 0)}</div>
      <div className="mt-2 text-xs text-muted-foreground">{bulkChampion?.label || 'No bulk scenario'} for one pack.</div>
    </div>
  </div>
);

export default ProductionCostOverviewCards;
