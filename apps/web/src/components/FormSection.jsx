
import React from 'react';

const FormSection = ({ title, description, children, className = '' }) => {
  return (
    <div className={`form-section ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-base font-semibold mb-1">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export default FormSection;
