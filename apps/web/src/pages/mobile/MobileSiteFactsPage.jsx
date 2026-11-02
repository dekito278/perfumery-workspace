import React from 'react';
import { Helmet } from 'react-helmet';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import SiteFactsForm from '@/components/studio/SiteFactsForm.jsx';

const MobileSiteFactsPage = () => (
  <MobileAuthenticatedLayout>
    <Helmet>
      <title>Fakta Toko - SOLIVAGANT Studio</title>
    </Helmet>
    <MobileTopBar title="Fakta toko" />
    <div className="grid gap-3 p-4">
      <p className="text-sm text-[#6b7280]">Angka dan nama yang tampil di toko. Berlaku langsung setelah disimpan.</p>
      <SiteFactsForm />
    </div>
  </MobileAuthenticatedLayout>
);

export default MobileSiteFactsPage;
