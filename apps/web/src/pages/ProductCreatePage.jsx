import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
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
        {/* The way back and the heading live in the form, which knows whether there is unsaved work. */}
        <ProductForm backTo="/studio/products" onSaved={() => navigate('/studio/products')} />
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductCreatePage;
