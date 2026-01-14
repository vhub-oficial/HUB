
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Bell, Plus } from 'lucide-react';
import { Button } from '../UI/Button';
import { useUI } from '../../contexts/UIContext';

export const Topbar: React.FC = () => {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const sp = new URLSearchParams(location.search);
  const type = sp.get('type');
  const { openNewAsset } = useUI();
  const [q, setQ] = React.useState(sp.get('q') ?? '');

  React.useEffect(() => {
    const sp2 = new URLSearchParams(location.search);
    setQ(sp2.get('q') ?? '');
  }, [location.search]);

  const applySearch = (next: string) => {
    // Always route search to dashboard; keep type if present
    const sp3 = new URLSearchParams();
    if (type) sp3.set('type', type);
    if (next.trim()) sp3.set('q', next.trim());
    navigate({ pathname: '/dashboard', search: `?${sp3.toString()}` }, { replace: true });
  };

  return (
    <>
      <header className="h-16 bg-background/80 backdrop-blur-md sticky top-0 z-20 px-6 flex items-center justify-between ml-64 border-b border-border">
        <div className="flex items-center flex-1 max-w-xl">
          <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
              <input 
                  type="text" 
                  placeholder="Search assets, folders, tags..." 
                  className="w-full bg-surface border border-border rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder:text-gray-600 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
                  value={q}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQ(v);
                    // debounce-ish
                    window.clearTimeout((window as any).__vhq);
                    (window as any).__vhq = window.setTimeout(() => applySearch(v), 250);
                  }}
              />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {profile?.role !== 'viewer' && (
            <Button
              onClick={() => openNewAsset(type ? type.toLowerCase() : null)}
              className="bg-gold hover:bg-gold/90 text-black font-semibold px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Plus size={18} />
              Novo Asset
            </Button>
          )}

          <button className="p-2 rounded-lg hover:bg-black/30 text-gray-300 hover:text-white transition">
            <Bell size={18} />
          </button>

          <div className="h-8 w-px bg-border mx-2"></div>

          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => navigate('/profile')}>
              <div className="text-right hidden md:block">
                  <p className="text-sm font-medium text-white">{profile?.name}</p>
                  <p className="text-xs text-gray-500 uppercase">{profile?.role}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gold/20 text-gold flex items-center justify-center font-bold border border-gold/30">
                  {profile?.name?.charAt(0) || 'U'}
              </div>
          </div>
        </div>
      </header>
    </>
  );
};
