import React, { useState } from 'react';
import { KeyRound, LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.jsx';
import { useAuth } from '@/contexts/AuthContext.jsx';

const MobileSessionActions = () => {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success('Logged out');
      navigate('/mobile/login', { replace: true });
    } catch (error) {
      toast.error(error.message || 'Failed to log out');
      setLoggingOut(false);
    }
  };

  return (
    <div className="mobile-session-actions">
      {open ? (
        <div className="mobile-session-panel">
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-bold text-[#1f2937]">{currentUser?.email || 'Solivagant'}</div>
            <div className="text-[10px] font-semibold text-[#6b7280]">Mobile session</div>
          </div>
          <Button type="button" variant="outline" onClick={handleLogout} disabled={loggingOut} className="h-9 rounded-xl border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700">
            <LogOut className="mr-1 h-4 w-4" />
            {loggingOut ? '...' : 'Logout'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/mobile/authenticator')} className="h-9 rounded-xl bg-white px-3 text-xs font-bold">
            <KeyRound className="mr-1 h-4 w-4" />
            Auth
          </Button>
        </div>
      ) : null}
      <Button type="button" size="icon" variant="outline" onClick={() => setOpen((current) => !current)} className="mobile-session-button" aria-label="Account and logout">
        {open ? <LogOut className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
      </Button>
    </div>
  );
};

export default MobileSessionActions;

