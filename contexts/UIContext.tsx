import React from 'react';

type State = {
  newAssetOpen: boolean;
  initialCategory: string | null;
  initialFolderId: string | null;
  openNewAsset: (initialCategory?: string | null, initialFolderId?: string | null) => void;
  closeNewAsset: () => void;
};

const UIContext = React.createContext<State | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [newAssetOpen, setNewAssetOpen] = React.useState(false);
  const [initialCategory, setInitialCategory] = React.useState<string | null>(null);
  const [initialFolderId, setInitialFolderId] = React.useState<string | null>(null);

  const openNewAsset = (category?: string | null, folderId?: string | null) => {
    setInitialCategory(category ?? null);
    setInitialFolderId(folderId ?? null);
    setNewAssetOpen(true);
  };

  const closeNewAsset = () => {
    setNewAssetOpen(false);
    setInitialCategory(null);
    setInitialFolderId(null);
  };

  return (
    <UIContext.Provider value={{ newAssetOpen, initialCategory, initialFolderId, openNewAsset, closeNewAsset }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const ctx = React.useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
};
