import React from 'react';
import { Helmet } from 'react-helmet';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import ProductWearTagger from '@/components/product/ProductWearTagger.jsx';

const MobileProductWearTaggingPage = () => {
  return (
    <MobileAuthenticatedLayout taskMode>
      <Helmet><title>Tandai kapan dipakai - Solivagant</title></Helmet>
      <MobileTopBar title="Kapan dipakai" subtitle="Momen, waktu, cuaca" eyebrow="Admin Studio" />
      <div className="grid gap-4 px-4 pb-28 pt-4">
        <ProductWearTagger compact />
      </div>
    </MobileAuthenticatedLayout>
  );
};

export default MobileProductWearTaggingPage;
