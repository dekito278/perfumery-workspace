
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, Package, Beaker, FlaskConical, LogOut, Tag, Calculator, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';

const AppShell = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/raw-materials', label: 'Raw materials', icon: Package },
    { path: '/categories', label: 'Categories', icon: Tag },
    { path: '/formulas', label: 'Formulas', icon: Beaker },
    { path: '/batches', label: 'Batches', icon: FlaskConical },
    { path: '/production-costing', label: 'Production cost', icon: Calculator }
  ];

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const NavLinks = ({ mobile = false }) => (
    <nav
      aria-label={mobile ? 'Mobile navigation' : 'Primary navigation'}
      className={`flex ${mobile ? 'flex-col' : 'flex-col'} gap-1`}
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => mobile && setMobileMenuOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-all ${
              active
                ? 'bg-primary text-primary-foreground shadow-[0_12px_30px_-18px_hsl(var(--primary)/0.8)]'
                : 'text-muted-foreground hover:bg-white/70 hover:text-foreground'
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-primary-foreground/14' : 'bg-muted/70'}`}>
              <Icon className="w-4 h-4" />
            </span>
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="app-shell">
        <aside className="app-sidebar no-print hidden lg:flex">
          <div className="app-sidebar-panel">
            <Link to="/dashboard" className="app-brand">
              <span className="app-brand-icon">
                <Beaker className="w-5 h-5" />
              </span>
              <span>
                <span className="app-brand-title">Perfumer Studio</span>
                <span className="app-brand-subtitle">Production workspace</span>
              </span>
            </Link>

            <div className="app-sidebar-intro">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                Focus Mode
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Semua alur utama sekarang dipusatkan ke formulas, batches, inventory, dan costing.
              </p>
            </div>

            <NavLinks />

            <div className="mt-auto rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Session</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Ready to formulate</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="mt-3 w-full justify-start gap-2 rounded-xl"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="app-topbar no-print">
            <div className="flex items-center gap-3">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="outline" size="icon" className="rounded-xl border-white/60 bg-white/70">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[86vw] max-w-sm border-r-0 bg-[#f8efe1] p-0">
                  <div className="flex h-full flex-col p-5">
                    <Link to="/dashboard" className="app-brand" onClick={() => setMobileMenuOpen(false)}>
                      <span className="app-brand-icon">
                        <Beaker className="w-5 h-5" />
                      </span>
                      <span>
                        <span className="app-brand-title">Perfumer Studio</span>
                        <span className="app-brand-subtitle">Production workspace</span>
                      </span>
                    </Link>
                    <div className="mt-6">
                      <NavLinks mobile />
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="mt-auto justify-start gap-2 rounded-xl"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>

              <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
                <span className="app-brand-icon h-10 w-10">
                  <Beaker className="w-5 h-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold leading-none">Perfumer Studio</span>
                  <span className="mt-1 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Formulas first</span>
                </span>
              </Link>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <div className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-medium text-muted-foreground">
                Unified formula workspace
              </div>
            </div>
          </header>

          <main className="app-main">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default AppShell;
