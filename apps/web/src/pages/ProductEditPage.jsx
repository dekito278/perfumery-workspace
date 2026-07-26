import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit3 } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import { Button } from '@/components/ui/button.jsx';
import ProductForm from '@/components/product/ProductForm.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';

const ProductEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const products = useCatalogProducts();
  const product = products.find((item) => item.id === id) || null;

  return (
    <AuthenticatedLayout>
      <Helmet>
        <title>Edit produk - Solivagant</title>
        <meta name="description" content="Edit produk custom di katalog Solivagant." />
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" className="h-10 gap-2" onClick={() => navigate('/studio/products')}>
            <ArrowLeft className="h-4 w-4" />
            Daftar produk
          </Button>
        </div>
        <div className="mb-6 flex items-center gap-3">
          <Edit3 className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold sm:text-4xl">Edit produk</h1>
        </div>

        {product ? (
          <ProductForm product={product} onSaved={() => navigate('/studio/products')} />
        ) : products.loading ? (
          <div className="rounded-2xl border bg-white/90 p-8 text-center text-sm font-semibold text-muted-foreground shadow-sm">
            Memuat produk...
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-[#fbfaf7] p-8 text-center">
            <h2 className="text-lg font-bold">Produk tidak ditemukan</h2>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">Produk ini mungkin sudah dihapus. Kembali ke daftar produk.</p>
            <Button className="mt-4 rounded-2xl" onClick={() => navigate('/studio/products')}>Ke daftar produk</Button>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
};

export default ProductEditPage;
