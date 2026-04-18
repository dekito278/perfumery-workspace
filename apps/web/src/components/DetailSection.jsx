
import React from 'react';

const DetailSection = ({ title, children, className = '' }) => {
  return (
    <div className={`detail-section print-avoid-break ${className}`}>
      {title && <h2 className="detail-section-title">{title}</h2>}
      {children}
    </div>
  );
};

export default DetailSection;
