
import React from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';

const DetailPageLayout = ({ children }) => {
  return (
    <AuthenticatedLayout>
      <div className="detail-page-container">
        {children}
      </div>
    </AuthenticatedLayout>
  );
};

export default DetailPageLayout;
