import React from 'react';
import { Helmet } from 'react-helmet';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout.jsx';
import MemberCodesEditor from '@/components/MemberCodesEditor.jsx';

const MemberCodesPage = () => (
  <AuthenticatedLayout>
    <Helmet><title>Kode member - Solivagant Studio</title></Helmet>
    <div className="mx-auto grid w-full max-w-5xl gap-5 p-6">
      <h1 className="text-2xl font-bold text-editorial-charcoal">Kode member</h1>
      <MemberCodesEditor />
    </div>
  </AuthenticatedLayout>
);

export default MemberCodesPage;
