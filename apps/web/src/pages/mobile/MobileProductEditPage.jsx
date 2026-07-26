import React from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit3 } from 'lucide-react';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import { Button } from '@/components/ui/button.jsx';
import MobileProductForm from '@/components/product/MobileProductForm.jsx';
import { useCatalogProducts } from '@/hooks/useCatalogProducts.js';

const MobileProductEditPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const products = useCatalogProducts();
  const product = products.find((item) => String(item.id) === String(id)) || null;

  return (
    <MobileAuthenticatedLayout taskMode>
      <Helmet>
        <title>Edit produk - Solivagant</title>
      </Helmet>
      <main className="mobile-page space-y-4">
        <MobileTopBar title="Edit produk" subtitle={product?.name || 'Produk katalog'} eyebrow="Admin Studio" action={<Edit3 className="h-5 w-5 text-amber-700" />} />
        <Button type="button" variant="outline" className="h-10 rounded-2xl bg-white gap-2 text-xs font-bold" onClick={() => navigate('/mobile/studio/products')}>
          <ArrowLeft className="h-4 w-4" />
          Daftar produk
        </Button>

        {product ? (
          <MobileProductForm product={product} onSaved={() => navigate('/mobile/studio/products')} />
        ) : products.loading ? (
          <div className="mobile-card p-5 text-center text-xs font-semibold text-[#6b7280]">Memuat produk...</div>
        ) : (
          <div className="mobile-card p-5 text-center">
            <h2 className="font-bold text-[#1f2937]">Produk tidak ditemukan</h2>
            <p className="mt-1 text-xs font-semibold text-[#6b7280]">Mungkin sudah dihapus. Kembali ke daftar produk.</p>
            <Button className="mt-3 h-11 rounded-2xl" onClick={() => navigate('/mobile/studio/products')}>Ke daftar produk</Button>
          </div>
        )}
      </main>
    </MobileAuthenticatedLayout>
  );
};

export default MobileProductEditPage;
