import React from 'react';
import { Asset } from '../../types';
import { Play } from 'lucide-react';

interface AssetCardProps {
  asset: Asset;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset }) => {
  // Determine primary tag for the badge
  const primaryTag = asset.tags[0] || 'ASSET';
  
  // Simulated duration or metadata (could be in DB later)
  const duration = "00:15"; // Mock
  const orientation = asset.tags.includes('tiktok') ? 'Vertical' : 'Horizontal';

  return (
    <div className="group bg-[#0f0f0f] rounded-xl overflow-hidden border border-[#222] hover:border-gold/50 transition-all duration-300 flex flex-col">
      {/* Thumbnail Container */}
      <div className="relative aspect-video bg-black w-full overflow-hidden">
        <img 
          src={asset.thumbnail_url} 
          alt={asset.name}
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
        />
        
        {/* Play Button Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40">
           <button className="bg-transparent border-2 border-gold text-gold rounded-full p-4 transform scale-90 group-hover:scale-100 transition-transform hover:bg-gold hover:text-black">
             <Play size={24} fill="currentColor" />
           </button>
        </div>

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] font-mono text-white flex items-center border border-white/10">
            <span className="mr-1">⏱</span> {duration}
        </div>
      </div>
      
      {/* Content Body */}
      <div className="p-4 bg-[#111] flex-1 flex flex-col justify-between">
        <div>
            <div className="flex justify-between items-start mb-1">
                <h3 className="text-sm font-bold text-white truncate pr-2">{asset.name}</h3>
                <span className="text-[10px] font-bold uppercase bg-[#1a1a1a] text-gray-400 border border-gray-800 px-1.5 py-0.5 rounded">
                    {primaryTag}
                </span>
            </div>
            <p className="text-[11px] text-gray-500 italic">{orientation}</p>
        </div>
      </div>

      {/* Footer / Action Button */}
      <div className="bg-[#151515] border-t border-[#222] p-0">
          <button className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-gold/80 hover:text-gold hover:bg-gold/5 transition-colors flex items-center justify-center gap-2">
            Download Drive
          </button>
      </div>
    </div>
  );
};