
import React from 'react';

const DetailField = ({ label, value, className = '' }) => {
  const hasContent = value !== null && value !== undefined && value !== '';

  return (
    <div className={`detail-field ${className}`}>
      <div className="detail-field-label">{label}</div>
      <div className={`detail-field-value ${hasContent ? '' : 'text-muted-foreground'}`}>
        {hasContent ? value : 'N/A'}
      </div>
    </div>
  );
};

export default DetailField;
