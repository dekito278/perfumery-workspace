import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { ArrowRight, UserRound } from 'lucide-react';
import MobileCommerceLayout from '@/layouts/MobileCommerceLayout.jsx';
import PublicHeader from '@/components/storefront/PublicHeader.jsx';
import StorefrontFooter from '@/components/storefront/StorefrontFooter.jsx';
import WhyBuyDirect from '@/components/storefront/WhyBuyDirect.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { useScrollReveal } from '@/hooks/useScrollReveal.js';

// Where the greeting card in every parcel points. One URL for every buyer who came from a marketplace,
// so it is noindex — it is a door, not a page to be found.
//
// The copy claims exactly one thing about price: the member price on signing in. It does not claim the
// shop is cheaper than the marketplace, because that has not been checked and a landing page that lies
// once is not believed twice.
const WelcomeContent = ({ mobile, currentUser, signIn }) => {
  const prefix = mobile ? '/mobile' : '';
  return (
    <>
      <p className={mobile ? 'm-editorial-eyebrow' : 'editorial-eyebrow'}>DARI KARTU DI PAKETMU</p>
      <h1 className={mobile ? 'mt-2 text-2xl font-bold text-editorial-charcoal' : 'storefront-display-heading mt-3 text-4xl font-bold sm:text-5xl'}>
        Terima kasih sudah memilih Solivagant.
      </h1>
      <p className={mobile ? 'mt-3 text-sm font-medium leading-relaxed text-[#6b7280]' : 'mt-4 max-w-xl text-base font-medium leading-relaxed text-muted-foreground'}>
        Parfum yang barusan sampai diracik di atelier ini. Kalau lain kali memesan langsung di sini, satu akun
        Google memberimu harga member di seluruh katalog, riwayat pesanan, dan pesan-lagi dalam sekali ketuk.
      </p>
      <div className={`mt-6 flex flex-wrap gap-3${mobile ? ' flex-col' : ''}`}>
        {currentUser ? (
          <Link to={`${prefix}/catalog`} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-editorial-charcoal px-5 text-sm font-bold text-editorial-ivory">
            Kamu sudah member — lihat koleksi <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Button type="button" onClick={signIn} className="h-12 rounded-2xl gap-2 px-5 text-sm font-bold">
            <UserRound className="h-4 w-4" /> Masuk dengan Google — harga member
          </Button>
        )}
        <Link to={`${prefix}/catalog`} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-editorial-charcoal/20 bg-white px-5 text-sm font-bold text-editorial-charcoal">
          Lihat koleksi dulu <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
};

const WelcomePage = ({ mobile = false }) => {
  const { currentUser, loginWithGoogle } = useAuth();
  const revealRef = useScrollReveal();
  const signIn = () => loginWithGoogle(`${window.location.origin}${mobile ? '/mobile/customer' : '/customer'}`).catch(() => {});

  const head = (
    <Helmet>
      <title>Selamat datang - Solivagant</title>
      <meta name="description" content="Terima kasih sudah memilih Solivagant. Masuk dengan Google untuk harga member di seluruh katalog." />
      <meta name="robots" content="noindex,follow" />
    </Helmet>
  );

  if (mobile) {
    return (
      <MobileCommerceLayout>
        {head}
        <main className="mobile-page m-editorial-page">
          <section className="mobile-card m-editorial-section p-5">
            <WelcomeContent mobile currentUser={currentUser} signIn={signIn} />
          </section>
          <WhyBuyDirect mobile />
        </main>
      </MobileCommerceLayout>
    );
  }

  return (
    <>
      {head}
      <main className="solivagant-editorial-home" ref={revealRef}>
        <PublicHeader />
        <section className="tracking-content">
          <div className="tracking-card">
            <WelcomeContent mobile={false} currentUser={currentUser} signIn={signIn} />
          </div>
        </section>
        <WhyBuyDirect />
        <StorefrontFooter />
      </main>
    </>
  );
};

export default WelcomePage;
