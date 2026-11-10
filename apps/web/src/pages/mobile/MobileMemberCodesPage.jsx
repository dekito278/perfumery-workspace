import React from 'react';
import { Helmet } from 'react-helmet';
import { BadgeCheck } from 'lucide-react';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import MemberCodesEditor from '@/components/MemberCodesEditor.jsx';

const MobileMemberCodesPage = () => (
  <MobileAuthenticatedLayout>
    <Helmet><title>Kode member - Solivagant Studio</title></Helmet>
    <main className="mobile-page space-y-4">
      <MobileTopBar
        title="Kode member"
        subtitle="Satu kode per komunitas"
        eyebrow="Harga member"
        action={<BadgeCheck className="h-5 w-5 text-amber-600" />}
      />
      <MemberCodesEditor />
    </main>
  </MobileAuthenticatedLayout>
);

export default MobileMemberCodesPage;
