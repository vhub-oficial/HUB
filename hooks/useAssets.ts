import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Asset } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface ListAssetsParams {
  folderId?: string | null;
  tag?: string;
  search?: string;
}

export const useAssets = ({ folderId, tag, search }: ListAssetsParams) => {
  const { organizationId } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) return;

    const fetchAssets = async () => {
      setLoading(true);
      try {
        let query = supabase
            .from('assets')
            .select('*')
            .eq('organization_id', organizationId);

        if (folderId && folderId !== 'root') {
            query = query.eq('folder_id', folderId);
        } else if (folderId === 'root') {
            query = query.is('folder_id', null);
        }
        
        if (tag) {
            query = query.contains('tags', [tag]);
        }

        if (search) {
            query = query.ilike('name', `%${search}%`);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            // Log the actual message, avoiding [object Object]
            console.error('Error loading assets:', error.message || error);
            setAssets([]);
        } else {
            setAssets(data as Asset[]);
        }
      } catch (err: any) {
        console.error("Unexpected error fetching assets:", err.message || err);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAssets();
  }, [organizationId, folderId, tag, search]);

  return { assets, loading };
};