
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Home, Package, Layers, Beaker, FlaskConical, LogOut, Tag } from 'lucide-react';
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
    { path: '/accords', label: 'Accords', icon: Layers },
    { path: '/formulas', label: 'Formulas', icon: Beaker },
    { path: '/batches', label: 'Batches', icon: FlaskConical }
  ];

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const NavLinks = ({ mobile = false }) => (
    <nav className={`flex ${mobile ? 'flex-col' : 'items-center'} gap-1`}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => mobile && setMobileMenuOpen(false)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/dashboard" className="flex items-center gap-2">
                <Beaker className="w-6 h-6 text-primary" />
                <span className="font-bold text-lg">Perfumer Studio</span>
              </Link>
              <div className="hidden md:block">
                <NavLinks />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="hidden md:flex gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>

              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-64">
                  <div className="flex flex-col gap-4 mt-8">
                    <NavLinks mobile />
                    <Button
                      variant="ghost"
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="justify-start gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
};

export default AppShell;
