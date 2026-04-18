
import React from 'react';

const FormSection = ({ title, description, children, className = '' }) => {
  return (
    <div className={`form-section ${className}`}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-base font-semibold mb-1">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export default FormSection;
