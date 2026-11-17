import React from 'react';
import { Helmet } from 'react-helmet';
import { WandSparkles } from 'lucide-react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import BespokeSettingsEditor from '@/components/BespokeSettingsEditor.jsx';

// The laptop twin of /mobile/studio/bespoke (17 Nov 2026). Same editor, same saves; only the frame differs.
const BespokeSettingsPage = () => (
  <AuthenticatedLayout>
    <Helmet><title>Pengaturan Bespoke - Solivagant</title></Helmet>
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6 lg:px-8">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <div className="dashboard-hero-eyebrow">
            <WandSparkles className="h-4 w-4 text-primary" />
            Bespoke ritual
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">Pengaturan bespoke</h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            Ukuran, botol, cap, label, dan material yang bisa dipilih pembeli di halaman bespoke, lengkap dengan harganya.
          </p>
        </div>
      </div>
      <BespokeSettingsEditor wide />
    </div>
  </AuthenticatedLayout>
);

export default BespokeSettingsPage;
