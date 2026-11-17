import React from 'react';
import { Helmet } from 'react-helmet';
import { WandSparkles } from 'lucide-react';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import BespokeSettingsEditor from '@/components/BespokeSettingsEditor.jsx';

const MobileBespokeSettingsPage = () => (
  <MobileAuthenticatedLayout>
    <Helmet><title>Pengaturan Bespoke - Solivagant</title></Helmet>
    <main className="mobile-page space-y-4">
      <MobileTopBar title="Bespoke" subtitle="Pengaturan wizard custom" eyebrow="E-commerce" action={<WandSparkles className="h-5 w-5 text-amber-700" />} />
      <BespokeSettingsEditor />
    </main>
  </MobileAuthenticatedLayout>
);

export default MobileBespokeSettingsPage;
