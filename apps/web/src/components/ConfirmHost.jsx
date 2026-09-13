import React, { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog.jsx';
import { registerConfirmHost } from '@/utils/confirmAction.js';

// Mounted once, beside the Toaster. Every confirmAction() in the app draws here.
const ConfirmHost = () => {
  const [request, setRequest] = useState(null);

  useEffect(() => registerConfirmHost((options) => new Promise((resolve) => {
    setRequest((current) => {
      // A second confirmation while one is open would strand the first caller in a promise that never
      // settles — and that caller is usually sitting in front of `if (!confirmed) return;`.
      current?.resolve(false);
      return { options, resolve };
    });
  })), []);

  // Unmounting with a question on screen has to answer it, for the same reason.
  useEffect(() => () => setRequest((current) => { current?.resolve(false); return null; }), []);

  const settle = (answer) => setRequest((current) => { current?.resolve(answer); return null; });

  if (!request) return null;
  const { message, title, confirmText, cancelText, destructive } = request.options;

  return (
    <ConfirmDialog
      open
      // Covers escape and clicking outside: anything but the confirm button is a no.
      onOpenChange={(next) => { if (!next) settle(false); }}
      onConfirm={() => settle(true)}
      title={title || (destructive ? 'Hapus permanen?' : 'Lanjutkan?')}
      description={message}
      confirmText={confirmText || (destructive ? 'Hapus' : 'Lanjut')}
      cancelText={cancelText || 'Batal'}
      destructive={Boolean(destructive)}
      variant={destructive ? 'destructive' : 'default'}
    />
  );
};

export default ConfirmHost;
