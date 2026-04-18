
import React from 'react';
import { formatDate } from '@/utils/formatting.js';

const DetailMetadata = ({ created, updated, additionalFields = [] }) => {
  return (
    <div className="detail-metadata">
      {created && (
        <div className="detail-metadata-item">
          <div className="detail-metadata-label">Created</div>
          <div className="detail-metadata-value">{formatDate(created)}</div>
        </div>
      )}
      {updated && (
        <div className="detail-metadata-item">
          <div className="detail-metadata-label">Last modified</div>
          <div className="detail-metadata-value">{formatDate(updated)}</div>
        </div>
      )}
      {additionalFields.map((field, index) => (
        <div key={index} className="detail-metadata-item">
          <div className="detail-metadata-label">{field.label}</div>
          <div className="detail-metadata-value">{field.value}</div>
        </div>
      ))}
    </div>
  );
};

export default DetailMetadata;
