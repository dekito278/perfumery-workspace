import React from 'react';
import DetailSection from '@/components/DetailSection.jsx';

const DirectionCard = ({ label, value }) => (
  <div className="rounded-xl border bg-card p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-2 whitespace-pre-wrap text-sm">{value || '-'}</div>
  </div>
);

const BriefDirectionSection = ({ brief }) => (
  <DetailSection title="Direction">
    <div className="grid gap-4 md:grid-cols-2">
      <DirectionCard label="Mood and story" value={brief.mood_story} />
      <DirectionCard label="Audience and usage" value={brief.audience_usage} />
      <DirectionCard label="Performance target" value={brief.performance_target} />
      <DirectionCard label="Budget and direction" value={brief.budget_direction} />
    </div>
  </DetailSection>
);

export default BriefDirectionSection;
