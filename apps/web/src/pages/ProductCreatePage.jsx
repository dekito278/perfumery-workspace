import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductForm from '@/components/product/ProductForm.jsx';

const ProductCreatePage = () => {
  const navigate = useNavigate();

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Tambah produk - Solivagant</title>
        <meta name="description" content="Tambah produk custom baru ke katalog Solivagant." />
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" className="h-10 gap-2" onClick={() => navigate('/studio/products')}>
            <ArrowLeft className="h-4 w-4" />
            Daftar produk
          </Button>
        </div>
        <div className="mb-6 flex items-center gap-3">
          <PackagePlus className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold sm:text-4xl">Tambah produk</h1>
        </div>
        <ProductForm onSaved={() => navigate('/studio/products')} />
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductCreatePage;
