import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Folder } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const useFolders = (parentId: string | null) => {
  const { organizationId } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) return;

    const fetchFolders = async () => {
      setLoading(true);
      try {
        let query = supabase
            .from('folders')
            .select('*')
            .eq('organization_id', organizationId);

        if (parentId === 'root' || parentId === null) {
            query = query.is('parent_id', null);
        } else {
            query = query.eq('parent_id', parentId);
        }

        const { data, error } = await query;

        if (error) {
            // Log the actual message, avoiding [object Object]
            console.error("Error fetching folders:", error.message || error);
            setFolders([]);
        } else {
            setFolders(data as Folder[]);
        }
      } catch (err: any) {
        console.error("Unexpected error fetching folders:", err.message || err);
        setFolders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFolders();
  }, [organizationId, parentId]);

  return { folders, loading };
};