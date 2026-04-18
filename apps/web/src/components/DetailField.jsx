
import React from 'react';

const DetailField = ({ label, value, className = '' }) => {
  return (
    <div className={`detail-field ${className}`}>
      <div className="detail-field-label">{label}</div>
      <div className="detail-field-value">{value || 'N/A'}</div>
    </div>
  );
};

export default DetailField;
