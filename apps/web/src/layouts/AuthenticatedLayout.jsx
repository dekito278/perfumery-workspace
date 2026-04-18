
import React from 'react';
import AppShell from '@/components/AppShell.jsx';

const AuthenticatedLayout = ({ children }) => {
  return <AppShell>{children}</AppShell>;
};

export default AuthenticatedLayout;
