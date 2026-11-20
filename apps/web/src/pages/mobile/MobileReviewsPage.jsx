import React from 'react';
import { Helmet } from 'react-helmet';
import { MessageSquareText } from 'lucide-react';
import MobileAuthenticatedLayout from '@/layouts/MobileAuthenticatedLayout.jsx';
import MobileTopBar from '@/components/mobile-ui/MobileTopBar.jsx';
import ReviewsModerator from '@/components/ReviewsModerator.jsx';

const MobileReviewsPage = () => (
  <MobileAuthenticatedLayout>
    <Helmet><title>Ulasan - Solivagant Studio</title></Helmet>
    <main className="mobile-page space-y-4">
      <MobileTopBar
        title="Ulasan"
        subtitle="Cek dulu sebelum tampil"
        eyebrow="Pembeli terverifikasi"
        action={<MessageSquareText className="h-5 w-5 text-amber-600" />}
      />
      <ReviewsModerator orderPath={(id) => `/mobile/studio/orders/${id}`} />
    </main>
  </MobileAuthenticatedLayout>
);

export default MobileReviewsPage;
