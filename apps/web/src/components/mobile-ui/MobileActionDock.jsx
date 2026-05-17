import React from 'react';
import { cn } from '@/lib/utils.js';

const MobileActionDock = ({ primary, secondary = [], destructive, className }) => (
  <section className={cn('mobile-card p-3', className)}>
    {primary ? <div>{primary}</div> : null}
    {secondary.length || destructive ? (
      <div className={cn('grid gap-2', primary && 'mt-2', destructive ? 'grid-cols-3' : secondary.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
        {secondary}
        {destructive}
      </div>
    ) : null}
  </section>
);

export default MobileActionDock;
