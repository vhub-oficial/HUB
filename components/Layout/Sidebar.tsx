import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  BadgeCheck,
  Film,
  User,
  LayoutDashboard,
  MessageCircle,
  Mic2,
  Music,
  Settings,
  Sparkles,
  Video,
  Volume2,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const normalizeType = (input: string | null | undefined) => {
    if (!input) return null;
    const t = String(input).trim().toLowerCase();

    const map: Record<string, string> = {
      'veo-3': 'veo3',
      veo_3: 'veo3',
      deepfake: 'deepfakes',
      voz: 'vozes',
      musica: 'musicas',
      'prova-social': 'provas-sociais',
      provas_sociais: 'provas-sociais',
      provassociais: 'provas-sociais',
      ugc: 'depoimentos-ugc',
      depoimentosugc: 'depoimentos-ugc',
      depoimentos_ugc: 'depoimentos-ugc',
    };

    return map[t] ?? t;
  };

  const { role } = useAuth();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentType = normalizeType(searchParams.get('type'));

  const isActive = (path: string, type?: string) => {
    const normalizedLinkType = normalizeType(type);
    if (normalizedLinkType) {
      return currentType === normalizedLinkType;
    }
    return location.pathname === path && !currentType;
  };

  const navItemClass = (active: boolean) => `
    flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 mb-1
    ${active 
      ? 'bg-gold/10 text-gold border-r-2 border-gold' 
      : 'text-gray-400 hover:text-white hover:bg-white/5'}
  `;

  const typeLink = (type: string) => `/dashboard?type=${encodeURIComponent(type)}`;

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
            <NavLink to="/dashboard" className={({isActive: rActive}) => navItemClass(rActive && !currentType)}>
                <LayoutDashboard size={18} className="mr-3" />
                Dashboard
            </NavLink>
            <NavLink to="/profile" className={({isActive: rActive}) => navItemClass(rActive)}>
                <User size={18} className="mr-3" />
                Perfil
            </NavLink>
        </div>

        <div className="mb-6">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Abas (Categorias)</p>
            
            <NavLink to={typeLink('deepfakes')} className={() => navItemClass(isActive('/dashboard', 'deepfakes'))}>
                <Sparkles size={18} className="mr-3" />
                Deepfakes
            </NavLink>

            <NavLink to={typeLink('vozes')} className={() => navItemClass(isActive('/dashboard', 'vozes'))}>
                <Mic2 size={18} className="mr-3" />
                Vozes para Clonar
            </NavLink>

            <NavLink to={typeLink('tiktok')} className={() => navItemClass(isActive('/dashboard', 'tiktok'))}>
                <Video size={18} className="mr-3" />
                TikTok
            </NavLink>

            <NavLink to={typeLink('musicas')} className={() => navItemClass(isActive('/dashboard', 'musicas'))}>
                <Music size={18} className="mr-3" />
                Músicas
            </NavLink>

            <NavLink to={typeLink('sfx')} className={() => navItemClass(isActive('/dashboard', 'sfx'))}>
                <Volume2 size={18} className="mr-3" />
                SFX
            </NavLink>

             <NavLink to={typeLink('veo3')} className={() => navItemClass(isActive('/dashboard', 'veo3'))}>
                <Film size={18} className="mr-3" />
                VEO 3
            </NavLink>

             <NavLink to={typeLink('provas-sociais')} className={() => navItemClass(isActive('/dashboard', 'provas-sociais'))}>
                <BadgeCheck size={18} className="mr-3" />
                Provas Sociais
            </NavLink>

             <NavLink to={typeLink('ugc')} className={() => navItemClass(isActive('/dashboard', 'ugc'))}>
                <MessageCircle size={18} className="mr-3" />
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
