import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { PackagePlus } from 'lucide-react';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MobileProductForm from '@/components/product/MobileProductForm.jsx';

const MobileProductCreatePage = () => {
  const navigate = useNavigate();

  return (
    <MobileAuthenticatedLayout taskMode>
      <Helmet>
        <title>Tambah produk - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Tambah produk" subtitle="Produk katalog baru" eyebrow="Admin Studio" action={<PackagePlus className="h-5 w-5 text-amber-700" />} />
        {/* The way back lives in the form, which knows whether there is unsaved work. */}
        <MobileProductForm backTo="/mobile/studio/products" onSaved={() => navigate('/mobile/studio/products')} />
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileProductCreatePage;
