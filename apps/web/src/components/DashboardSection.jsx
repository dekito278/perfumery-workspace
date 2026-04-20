
import React from 'react';

const DashboardSection = ({ title, subtitle, children }) => {
  return (
    <div className="dashboard-section">
      {title && (
        <div className="dashboard-section-header">
          <h2 className="dashboard-section-title">{title}</h2>
        </div>
      )}
      {children}
    </div>
  );
};

export default DashboardSection;
