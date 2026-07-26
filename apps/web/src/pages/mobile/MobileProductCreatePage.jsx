import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
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
        <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={() => navigate('/mobile/studio/products')}>
          <ArrowLeft className="h-4 w-4" />
          Daftar produk
        </Button>
        <MobileProductForm onSaved={() => navigate('/mobile/studio/products')} />
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileProductCreatePage;
