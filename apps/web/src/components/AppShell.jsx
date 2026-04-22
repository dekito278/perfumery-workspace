
import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, Package, Beaker, FlaskConical, LogOut, Calculator, ChevronsLeft, ChevronsRight, Radar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.jsx';

const DESKTOP_SIDEBAR_STORAGE_KEY = 'perfumer-studio.sidebar-collapsed';

const AppShell = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(true);

  useEffect(() => {
    const savedValue = window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY);
    if (savedValue === null) {
      return;
    }

    setDesktopSidebarCollapsed(savedValue === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DESKTOP_SIDEBAR_STORAGE_KEY, String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed]);

  const displayName =
    currentUser?.user_metadata?.name?.trim()
    || currentUser?.email?.split('@')[0]
    || 'Dekito';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home },
    { path: '/raw-materials', label: 'Raw materials', icon: Package },
    { path: '/raw-material-audit', label: 'Material Audit', icon: Radar },
    { path: '/formulas', label: 'Formulas', icon: Beaker },
    { path: '/batches', label: 'Batches', icon: FlaskConical },
    { path: '/production-costing', label: 'Production cost', icon: Calculator }
  ];

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const NavLinks = ({ mobile = false, collapsed = false }) => (
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
            title={!mobile && collapsed ? item.label : undefined}
            className={`flex items-center ${collapsed ? 'justify-center px-2.5' : 'gap-3 px-3'} rounded-2xl py-3 text-sm font-medium transition-all ${
              active
                ? 'bg-primary text-primary-foreground shadow-[0_12px_30px_-18px_hsl(var(--primary)/0.8)]'
                : 'text-muted-foreground hover:bg-white/70 hover:text-foreground'
            }`}
          >
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-primary-foreground/14' : 'bg-muted/70'}`}>
              <Icon className="w-4 h-4" />
            </span>
            {!collapsed && <span className="flex-1">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="app-shell">
        <aside className={`app-sidebar no-print hidden lg:flex ${desktopSidebarCollapsed ? 'app-sidebar-collapsed' : ''}`}>
          <div className="app-sidebar-panel">
            <div className={`flex items-center ${desktopSidebarCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
              <Link to="/dashboard" className="app-brand">
              <span className="app-brand-icon">
                <Beaker className="w-5 h-5" />
              </span>
              {!desktopSidebarCollapsed && (
                <span>
                  <span className="app-brand-title">Perfumer Studio</span>
                  <span className="app-brand-subtitle">Small batch lab</span>
                </span>
              )}
              </Link>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setDesktopSidebarCollapsed((current) => !current)}
                className="h-10 w-10 rounded-2xl"
                title={desktopSidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                aria-label={desktopSidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
              >
                {desktopSidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
              </Button>
            </div>

            <NavLinks collapsed={desktopSidebarCollapsed} />

            <div className={`mt-auto rounded-3xl border border-white/70 bg-white/85 p-4 shadow-sm ${desktopSidebarCollapsed ? 'px-2 py-3' : ''}`}>
              {!desktopSidebarCollapsed && (
                <>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Session</p>
                  <p className="mt-2 text-sm font-semibold text-foreground">{displayName} is in the lab</p>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className={`w-full gap-2 rounded-xl ${desktopSidebarCollapsed ? 'mt-0 justify-center px-0' : 'mt-3 justify-start'}`}
                title={desktopSidebarCollapsed ? 'Logout' : undefined}
              >
                <LogOut className="w-4 h-4" />
                {!desktopSidebarCollapsed && 'Logout'}
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
                        <span className="app-brand-subtitle">Small batch lab</span>
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

              <Link to="/dashboard" className="min-w-0 flex items-center gap-2 lg:hidden">
                <span className="app-brand-icon h-10 w-10">
                  <Beaker className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold leading-none">Perfumer Studio</span>
                  <span className="mt-1 block truncate text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Halo, {displayName}</span>
                </span>
              </Link>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDesktopSidebarCollapsed((current) => !current)}
                className="rounded-2xl border-white/70 bg-white/75"
                title={desktopSidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
                aria-label={desktopSidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
              >
                {desktopSidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
              </Button>
              <div className="rounded-full border border-white/70 bg-white/70 px-4 py-2 text-xs font-medium text-muted-foreground">
                Halo, {displayName}
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
