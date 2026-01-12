import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  LayoutDashboard, 
  FolderOpen, 
  Video, 
  Mic, 
  Music, 
  Activity, 
  Clapperboard, 
  Users, 
  Settings,
  Sparkles
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { role } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentTag = searchParams.get('tag');

  const isActive = (path: string, tag?: string) => {
    if (tag) {
        return currentTag === tag;
    }
    return location.pathname === path && !currentTag;
  };

  const navItemClass = (active: boolean) => `
    flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 mb-1
    ${active 
      ? 'bg-gold/10 text-gold border-r-2 border-gold' 
      : 'text-gray-400 hover:text-white hover:bg-white/5'}
  `;

  const tagLink = (tag: string) => `/dashboard?tag=${encodeURIComponent(tag)}`;

  return (
    <aside className="w-64 bg-surface border-r border-border flex flex-col h-screen fixed left-0 top-0">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center">
          <span className="text-gold mr-2">✦</span> V•HUB
        </h1>
      </div>

      <nav className="flex-1 px-3 overflow-y-auto custom-scrollbar">
        <div className="mb-6">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Main</p>
            <NavLink to="/dashboard" className={({isActive: rActive}) => navItemClass(rActive && !currentTag)}>
                <LayoutDashboard size={18} className="mr-3" />
                Dashboard
            </NavLink>
            <NavLink to="/folders/root" className={({isActive: rActive}) => navItemClass(rActive && !currentTag)}>
                <FolderOpen size={18} className="mr-3" />
                Pastas
            </NavLink>
        </div>

        <div className="mb-6">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Smart Filters</p>
            
            <NavLink to={tagLink('deepfake')} className={() => navItemClass(isActive('/dashboard', 'deepfake'))}>
                <Video size={18} className="mr-3" />
                Deepfakes
            </NavLink>

            <NavLink to={tagLink('voz-clonada')} className={() => navItemClass(isActive('/dashboard', 'voz-clonada'))}>
                <Mic size={18} className="mr-3" />
                Vozes Clonadas
            </NavLink>

            <NavLink to={tagLink('tiktok')} className={() => navItemClass(isActive('/dashboard', 'tiktok'))}>
                <Activity size={18} className="mr-3" />
                TikTok Trends
            </NavLink>

            <NavLink to={tagLink('musica')} className={() => navItemClass(isActive('/dashboard', 'musica'))}>
                <Music size={18} className="mr-3" />
                Músicas
            </NavLink>

            <NavLink to={tagLink('sfx')} className={() => navItemClass(isActive('/dashboard', 'sfx'))}>
                <Sparkles size={18} className="mr-3" />
                SFX
            </NavLink>

             <NavLink to={tagLink('veo3')} className={() => navItemClass(isActive('/dashboard', 'veo3'))}>
                <Clapperboard size={18} className="mr-3" />
                VEO 3
            </NavLink>

             <NavLink to={tagLink('prova-social')} className={() => navItemClass(isActive('/dashboard', 'prova-social'))}>
                <Users size={18} className="mr-3" />
                Provas Sociais
            </NavLink>

             <NavLink to={tagLink('ugc')} className={() => navItemClass(isActive('/dashboard', 'ugc'))}>
                <Users size={18} className="mr-3" />
                Depoimentos UGC
            </NavLink>
        </div>
      </nav>

      {role === 'admin' && (
        <div className="p-4 border-t border-border">
           <NavLink to="/admin" className={({isActive: rActive}) => navItemClass(rActive)}>
              <Settings size={18} className="mr-3" />
              Admin & Planos
          </NavLink>
        </div>
      )}
    </aside>
  );
};
