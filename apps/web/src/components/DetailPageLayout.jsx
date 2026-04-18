
import React from 'react';

const DetailPageLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <div className="detail-page-container">
        {children}
      </div>
    </div>
  );
};

export default DetailPageLayout;
