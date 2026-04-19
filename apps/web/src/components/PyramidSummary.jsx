
import React from 'react';

const getProfileLabel = (item) => {
  if (item.item_type === 'solvent') {
    return item.name || 'Solvent';
  }

  return item.component_family || item.scent_family || item.category || 'Material';
};

const PyramidSummary = ({ items }) => {
  const profileData = items.reduce((acc, item) => {
    const label = getProfileLabel(item);
    acc[label] = (acc[label] || 0) + Number(item.percentage || 0);
    return acc;
  }, {});

  const profileItems = Object.entries(profileData)
    .map(([label, percentage]) => ({ label, percentage }))
    .sort((left, right) => right.percentage - left.percentage);

  if (!profileItems.length) {
    return (
      <div className="text-xs text-muted-foreground italic">
        No composition profile available
      </div>
    );
  }

  const topProfiles = profileItems.slice(0, 6);

  return (
    <div className="space-y-3">
      {topProfiles.map((profile) => (
        <div key={profile.label} className="space-y-1">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-medium">{profile.label}</span>
            <span className="font-mono">{profile.percentage.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(profile.percentage, 100)}%` }}
              title={`${profile.label}: ${profile.percentage.toFixed(1)}%`}
            />
          </div>
        </div>
      ))}
      {profileItems.length > topProfiles.length && (
        <p className="text-xs text-muted-foreground">
          +{profileItems.length - topProfiles.length} more composition groups
        </p>
      )}
    </div>
  );
};

export default PyramidSummary;
