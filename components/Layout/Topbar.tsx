
import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Bell, Plus } from 'lucide-react';
import { Button } from '../UI/Button';
import { NewAssetModal } from '../Assets/NewAssetModal';

export const Topbar: React.FC = () => {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const [openNew, setOpenNew] = React.useState(false);
  const sp = new URLSearchParams(location.search);
  const type = sp.get('type');

  return (
    <>
      <header className="h-16 bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-20 px-6 flex items-center justify-between ml-64">
        <div className="flex items-center flex-1 max-w-xl">
          <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
              <input 
                  type="text" 
                  placeholder="Search assets, folders, tags..." 
                  className="w-full bg-surface border border-border text-sm text-white rounded-md pl-10 pr-4 py-2 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold"
              />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {profile?.role !== 'viewer' && (
              <Button size="sm" className="hidden sm:flex" onClick={() => setOpenNew(true)}>
                  <Plus size={16} className="mr-2" /> + Novo Asset
              </Button>
          )}
          
          <button className="text-gray-400 hover:text-white relative">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-gold rounded-full"></span>
          </button>

          <div className="h-8 w-px bg-border mx-2"></div>

          <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => signOut()}>
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
      <NewAssetModal
        open={openNew}
        onClose={() => setOpenNew(false)}
        initialCategory={type ? type.toLowerCase() : null}
      />
    </>
  );
};
