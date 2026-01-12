import React from 'react';

export const AdminPage: React.FC = () => {
  return (
    <div className="p-8 space-y-6 min-h-screen">
      <div className="flex items-center gap-2 border-l-4 border-gold pl-4">
        <h1 className="text-sm font-bold text-gray-200 uppercase tracking-widest">
          Administração
        </h1>
      </div>
      <div className="bg-surface border border-border rounded-xl p-6 text-gray-400">
        <p>Área administrativa restrita.</p>
      </div>
    </div>
  );
};
