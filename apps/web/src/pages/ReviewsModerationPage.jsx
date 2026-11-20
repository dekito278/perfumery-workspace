import React from 'react';
import { Helmet } from 'react-helmet';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import ReviewsModerator from '@/components/ReviewsModerator.jsx';

const ReviewsModerationPage = () => (
  <AuthenticatedLayout>
    <Helmet><title>Ulasan - Solivagant Studio</title></Helmet>
    <div className="mx-auto grid w-full max-w-5xl gap-5 p-6">
      <h1 className="text-2xl font-bold text-editorial-charcoal">Ulasan pembeli</h1>
      <ReviewsModerator />
    </div>
  </AuthenticatedLayout>
);

export default ReviewsModerationPage;
