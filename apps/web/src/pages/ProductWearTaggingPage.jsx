import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductWearTagger from '@/components/product/ProductWearTagger.jsx';

const ProductWearTaggingPage = () => {
  const navigate = useNavigate();

  return (
    <AuthenticatedLayout>
      <Helmet><title>Tandai kapan dipakai - Solivagant Studio</title></Helmet>
      <div className="mx-auto grid w-full max-w-4xl gap-6 p-6">
        <div className="grid gap-2">
          <Button variant="ghost" className="w-fit gap-2 px-0" onClick={() => navigate('/studio/products')}>
            <ArrowLeft className="h-4 w-4" /> Produk
          </Button>
          <h1 className="text-2xl font-bold text-editorial-charcoal">Tandai kapan dipakai</h1>
          <p className="text-sm text-muted-foreground">
            Momen, waktu, dan cuaca untuk setiap parfum. Ini yang dipakai filter di halaman koleksi.
          </p>
        </div>
        <ProductWearTagger />
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductWearTaggingPage;
