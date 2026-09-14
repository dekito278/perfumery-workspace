import React from 'react';

// What a customer sees while a storefront page loads on the phone: the wordmark, nothing else.
// Not "Loading workspace" — there is no workspace, and the word is the owner's, not theirs.
const StorefrontSplash = () => (
  <div
    className="mobile-page mobile-centered-state min-h-screen bg-editorial-ivory"
    role="status"
    aria-live="polite"
    aria-label="Memuat Solivagant"
  >
    <span className="m-editorial-wordmark mobile-loading-breathe text-2xl">SOLIVAGANT</span>
  </div>
);

export default StorefrontSplash;
