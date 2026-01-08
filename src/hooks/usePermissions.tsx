import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppRole } from '@/types/kpm';

export interface Permission {
  permission_code: string;
  module: string;
  name: string;
}

export interface ModulePermissions {
  module: string;
  permissions: Permission[];
}

interface UsePermissionsReturn {
  permissions: Permission[];
  modules: string[];
  isLoading: boolean;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
  hasAllPermissions: (codes: string[]) => boolean;
  canViewModule: (module: string) => boolean;
  refreshPermissions: () => Promise<void>;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, isAdmin, roles } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setModules([]);
      setIsLoading(false);
      return;
    }

    try {
      // Fetch user permissions
      const { data: permsData, error: permsError } = await supabase
        .rpc('get_user_permissions', { _user_id: user.id });

      if (permsError) throw permsError;

      setPermissions(permsData || []);

      // Extract unique modules where user has "voir" permission
      const uniqueModules = [...new Set((permsData || [])
        .filter((p: Permission) => p.permission_code.endsWith('.voir'))
        .map((p: Permission) => p.module))];
      
      setModules(uniqueModules);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions([]);
      setModules([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const hasPermission = useCallback((code: string): boolean => {
    // Admin has all permissions
    if (isAdmin) return true;
    return permissions.some(p => p.permission_code === code);
  }, [permissions, isAdmin]);

  const hasAnyPermission = useCallback((codes: string[]): boolean => {
    if (isAdmin) return true;
    return codes.some(code => permissions.some(p => p.permission_code === code));
  }, [permissions, isAdmin]);

  const hasAllPermissions = useCallback((codes: string[]): boolean => {
    if (isAdmin) return true;
    return codes.every(code => permissions.some(p => p.permission_code === code));
  }, [permissions, isAdmin]);

  const canViewModule = useCallback((module: string): boolean => {
    if (isAdmin) return true;
    return modules.includes(module);
  }, [modules, isAdmin]);

  return {
    permissions,
    modules,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canViewModule,
    refreshPermissions: fetchPermissions,
  };
}

// Module to route mapping for sidebar filtering
export const MODULE_ROUTES: Record<string, string[]> = {
  dashboard: ['/dashboard'],
  administration: ['/admin', '/admin/users', '/admin/departments', '/admin/roles', '/admin/units', '/admin/payment-categories', '/admin/comptes-comptables', '/admin/settings'],
  expressions: ['/expressions-besoin'],
  besoins: ['/besoins'],
  da: ['/demandes-achat'],
  bl: ['/bons-livraison'],
  fournisseurs: ['/fournisseurs'],
  stock: ['/stock'],
  comptabilite: ['/comptabilite'],
  projets: ['/projets'],
  notes_frais: ['/notes-frais'],
  caisse: ['/caisse'],
  audit: ['/audit'],
  rapports: ['/reports'],
};

// Labels for modules (French)
export const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  administration: 'Administration',
  expressions: 'Expressions de besoin',
  besoins: 'Besoins internes',
  da: 'Demandes d\'achat',
  bl: 'Bons de livraison',
  fournisseurs: 'Fournisseurs',
  stock: 'Stock',
  comptabilite: 'Comptabilité',
  projets: 'Projets',
  notes_frais: 'Notes de frais',
  caisse: 'Caisse',
  audit: 'Journal d\'audit',
  rapports: 'Rapports',
};

// Action labels (French)
export const ACTION_LABELS: Record<string, string> = {
  voir: 'Voir',
  lire: 'Lire',
  ecrire: 'Écrire',
  supprimer: 'Supprimer',
};
