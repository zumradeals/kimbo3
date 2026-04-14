import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if AAL bypass is enabled (poste vacant).
 * When enabled, workflows skip the AAL validation step.
 */
export function useAALBypass() {
  const [aalBypassEnabled, setAalBypassEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'aal_bypass_enabled')
          .single();

        if (!error && data) {
          setAalBypassEnabled(data.value === 'true');
        }
      } catch {
        // Default to false if setting doesn't exist
      } finally {
        setIsLoading(false);
      }
    };

    fetchSetting();
  }, []);

  return { aalBypassEnabled, isLoading };
}
