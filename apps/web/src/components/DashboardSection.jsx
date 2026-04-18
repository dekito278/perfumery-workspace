
import React from 'react';

const DashboardSection = ({ title, subtitle, children }) => {
  return (
    <div className="dashboard-section">
      {(title || subtitle) && (
        <div className="dashboard-section-header">
          {title && <h2 className="dashboard-section-title">{title}</h2>}
          {subtitle && <p className="dashboard-section-subtitle">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

export default DashboardSection;
