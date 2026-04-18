
import React from 'react';

const DetailFieldGroup = ({ children, columns = 2, className = '' }) => {
  const columnClass = columns === 3 ? 'detail-field-group-3' : columns === 4 ? 'detail-field-group-4' : '';
  
  return (
    <div className={`detail-field-group ${columnClass} ${className}`}>
      {children}
    </div>
  );
};

export default DetailFieldGroup;
