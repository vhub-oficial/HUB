import React from 'react';

type State = {
  newAssetOpen: boolean;
  initialCategory: string | null;
  openNewAsset: (initialCategory?: string | null) => void;
  closeNewAsset: () => void;
};

const UIContext = React.createContext<State | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [newAssetOpen, setNewAssetOpen] = React.useState(false);
  const [initialCategory, setInitialCategory] = React.useState<string | null>(null);

  const openNewAsset = (category?: string | null) => {
    setInitialCategory(category ?? null);
    setNewAssetOpen(true);
  };

  const closeNewAsset = () => setNewAssetOpen(false);

  return (
    <UIContext.Provider value={{ newAssetOpen, initialCategory, openNewAsset, closeNewAsset }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const ctx = React.useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
};
