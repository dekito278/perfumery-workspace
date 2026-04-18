
import React from 'react';
import { TrendingUp, Minus, TrendingDown } from 'lucide-react';

const PyramidSummary = ({ items }) => {
  const pyramidData = items.reduce((acc, item) => {
    const placement = item.pyramid_placement || 'unknown';
    acc[placement] = (acc[placement] || 0) + (item.percentage || 0);
    return acc;
  }, {});

  const top = pyramidData.top || 0;
  const middle = pyramidData.middle || 0;
  const base = pyramidData.base || 0;
  const total = top + middle + base;

  if (total === 0) {
    return (
      <div className="text-xs text-muted-foreground italic">
        No pyramid data available
      </div>
    );
  }

  const topPercent = (top / total) * 100;
  const middlePercent = (middle / total) * 100;
  const basePercent = (base / total) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
        <span className="font-medium">Top:</span>
        <span className="font-mono">{topPercent.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <Minus className="w-3.5 h-3.5 text-rose-600" />
        <span className="font-medium">Middle:</span>
        <span className="font-mono">{middlePercent.toFixed(1)}%</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <TrendingDown className="w-3.5 h-3.5 text-amber-800" />
        <span className="font-medium">Base:</span>
        <span className="font-mono">{basePercent.toFixed(1)}%</span>
      </div>
      
      <div className="h-4 flex rounded overflow-hidden mt-3">
        {topPercent > 0 && (
          <div 
            className="bg-amber-400" 
            style={{ width: `${topPercent}%` }}
            title={`Top: ${topPercent.toFixed(1)}%`}
          />
        )}
        {middlePercent > 0 && (
          <div 
            className="bg-rose-400" 
            style={{ width: `${middlePercent}%` }}
            title={`Middle: ${middlePercent.toFixed(1)}%`}
          />
        )}
        {basePercent > 0 && (
          <div 
            className="bg-amber-700" 
            style={{ width: `${basePercent}%` }}
            title={`Base: ${basePercent.toFixed(1)}%`}
          />
        )}
      </div>
    </div>
  );
};

export default PyramidSummary;
