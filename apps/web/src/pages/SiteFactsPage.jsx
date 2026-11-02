import React from 'react';
import { Helmet } from 'react-helmet';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import SiteFactsForm from '@/components/studio/SiteFactsForm.jsx';

const SiteFactsPage = () => (
  <AuthenticatedLayout>
    <Helmet>
      <title>Fakta Toko - SOLIVAGANT Studio</title>
    </Helmet>
    <div className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold">Fakta toko</h1>
        <p className="mt-1 text-sm text-[#6b7280]">Angka dan nama yang tampil di toko. Berlaku langsung setelah disimpan.</p>
      </div>
      <SiteFactsForm />
    </div>
  </AuthenticatedLayout>
);

export default SiteFactsPage;
