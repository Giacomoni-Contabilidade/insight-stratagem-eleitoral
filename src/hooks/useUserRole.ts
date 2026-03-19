import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export const useUserRole = (user: User | null) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: user.id,
          _role: 'admin',
        });

        if (error) throw error;
        setIsAdmin(Boolean(data));
      } catch (err) {
        console.error('Error fetching role:', err);
        setIsAdmin(false);
      } finally {
        setRoleLoading(false);
      }
    };

    fetchRole();
  }, [user]);

  return { isAdmin, roleLoading };
};
