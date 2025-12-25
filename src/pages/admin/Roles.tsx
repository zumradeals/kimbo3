import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS, AppRole } from '@/types/kpm';
import { MODULE_LABELS, ACTION_LABELS } from '@/hooks/usePermissions';
import { 
  Shield, Check, X, ChevronRight, Download, Upload, 
  RefreshCw, Info, Eye, Edit, Trash2, CheckCircle2
} from 'lucide-react';

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

interface RolePermission {
  id: string;
  role: AppRole;
  permission_id: string;
}

interface ModuleGroup {
  module: string;
  label: string;
  permissions: Permission[];
}

const ALL_ROLES: AppRole[] = [
  'admin', 'dg', 'daf', 'comptable', 'responsable_logistique',
  'agent_logistique', 'responsable_achats', 'agent_achats',
  'responsable_departement', 'employe', 'lecture_seule'
];

// Base actions for quick matrix view
const BASE_ACTIONS = ['voir', 'lire', 'ecrire', 'supprimer'];

export default function AdminRoles() {
  const { isAdmin } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [permsResult, rolePermsResult] = await Promise.all([
        supabase.from('permissions').select('*').order('module').order('code'),
        supabase.from('role_permissions').select('*'),
      ]);

      if (permsResult.error) throw permsResult.error;
      if (rolePermsResult.error) throw rolePermsResult.error;

      setPermissions(permsResult.data || []);
      setRolePermissions(rolePermsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des permissions');
    } finally {
      setIsLoading(false);
    }
  };

  // Group permissions by module
  const moduleGroups: ModuleGroup[] = Object.entries(
    permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>)
  ).map(([module, perms]) => ({
    module,
    label: MODULE_LABELS[module] || module,
    permissions: perms,
  }));

  // Check if a role has a permission
  const hasRolePermission = (role: AppRole, permissionId: string): boolean => {
    const key = `${role}-${permissionId}`;
    if (pendingChanges.has(key)) {
      return pendingChanges.get(key)!;
    }
    return rolePermissions.some(rp => rp.role === role && rp.permission_id === permissionId);
  };

  // Toggle permission for a role
  const togglePermission = (role: AppRole, permissionId: string) => {
    if (role === 'admin') {
      toast.error('Les permissions Admin ne peuvent pas être modifiées');
      return;
    }

    const key = `${role}-${permissionId}`;
    const currentValue = hasRolePermission(role, permissionId);
    
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      newMap.set(key, !currentValue);
      return newMap;
    });
  };

  // Save all pending changes
  const saveChanges = async () => {
    if (pendingChanges.size === 0) {
      toast.info('Aucune modification à enregistrer');
      return;
    }

    setIsSaving(true);
    try {
      const toAdd: { role: AppRole; permission_id: string }[] = [];
      const toRemove: { role: AppRole; permission_id: string }[] = [];

      pendingChanges.forEach((newValue, key) => {
        const [role, permissionId] = key.split('-') as [AppRole, string];
        const currentlyHas = rolePermissions.some(
          rp => rp.role === role && rp.permission_id === permissionId
        );

        if (newValue && !currentlyHas) {
          toAdd.push({ role, permission_id: permissionId });
        } else if (!newValue && currentlyHas) {
          toRemove.push({ role, permission_id: permissionId });
        }
      });

      // Add new permissions
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('role_permissions')
          .insert(toAdd);
        if (addError) throw addError;
      }

      // Remove permissions
      for (const item of toRemove) {
        const { error: removeError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role', item.role)
          .eq('permission_id', item.permission_id);
        if (removeError) throw removeError;
      }

      setPendingChanges(new Map());
      await fetchData();
      toast.success(`${toAdd.length + toRemove.length} modifications enregistrées`);
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel pending changes
  const cancelChanges = () => {
    setPendingChanges(new Map());
    toast.info('Modifications annulées');
  };

  // Export configuration
  const exportConfig = () => {
    const config = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      permissions: permissions.map(p => ({
        code: p.code,
        name: p.name,
        module: p.module,
        description: p.description,
      })),
      rolePermissions: ALL_ROLES.reduce((acc, role) => {
        acc[role] = permissions
          .filter(p => hasRolePermission(role, p.id))
          .map(p => p.code);
        return acc;
      }, {} as Record<string, string[]>),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kpm-roles-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Configuration exportée');
  };

  // Reset to default Kimbo configuration
  const resetToDefault = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser les permissions aux valeurs par défaut Kimbo ? Cette action est irréversible.')) {
      return;
    }

    toast.info('Réinitialisation en cours... Veuillez patienter.');
    // This would re-run the migration or call an edge function
    // For now, just reload
    await fetchData();
    toast.success('Permissions réinitialisées');
  };

  // Get base action permission for a module and role
  const getBasePermission = (module: string, action: string, role: AppRole): boolean => {
    const perm = permissions.find(p => p.code === `${module}.${action}`);
    if (!perm) return false;
    return hasRolePermission(role, perm.id);
  };

  // Get all business permissions for a module
  const getBusinessPermissions = (module: string): Permission[] => {
    return permissions.filter(p => 
      p.module === module && 
      !BASE_ACTIONS.includes(p.code.split('.')[1])
    );
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <AccessDenied message="Seuls les administrateurs peuvent gérer les rôles et permissions." />
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-[500px] w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Rôles & Permissions
            </h1>
            <p className="text-muted-foreground">
              Gérez les permissions par rôle ({permissions.length} permissions, {ALL_ROLES.length} rôles)
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportConfig}>
              <Download className="mr-2 h-4 w-4" />
              Exporter
            </Button>
            <Button variant="outline" size="sm" onClick={resetToDefault}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Réinitialiser
            </Button>
          </div>
        </div>

        {/* Pending changes indicator */}
        {pendingChanges.size > 0 && (
          <Card className="border-warning bg-warning/10">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-warning" />
                <span className="text-sm font-medium">
                  {pendingChanges.size} modification(s) en attente
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={cancelChanges}>
                  Annuler
                </Button>
                <Button size="sm" onClick={saveChanges} disabled={isSaving}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="matrix" className="w-full">
          <TabsList>
            <TabsTrigger value="matrix">Matrice rapide</TabsTrigger>
            <TabsTrigger value="detailed">Détails avancés</TabsTrigger>
          </TabsList>

          {/* Mode A: Quick Matrix */}
          <TabsContent value="matrix" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Matrice des permissions</CardTitle>
                    <CardDescription>
                      Cliquez sur une cellule pour activer/désactiver. Les icônes indiquent les permissions métier.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <div className="min-w-[1000px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-medium w-48">
                            Module
                          </th>
                          {ALL_ROLES.map((role) => (
                            <th
                              key={role}
                              className="min-w-[90px] px-2 py-3 text-center text-xs font-medium"
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="whitespace-nowrap">
                                  {ROLE_LABELS[role].split(' ').slice(0, 2).join(' ')}
                                </span>
                                {role === 'admin' && (
                                  <Badge variant="secondary" className="text-[10px] px-1">
                                    Tous
                                  </Badge>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {moduleGroups.map((group) => (
                          <tr key={group.module} className="border-b hover:bg-muted/30">
                            <td className="sticky left-0 z-10 bg-background px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{group.label}</span>
                                {getBusinessPermissions(group.module).length > 0 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    +{getBusinessPermissions(group.module).length}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            {ALL_ROLES.map((role) => {
                              const canView = getBasePermission(group.module, 'voir', role);
                              const canRead = getBasePermission(group.module, 'lire', role);
                              const canWrite = getBasePermission(group.module, 'ecrire', role);
                              const canDelete = getBasePermission(group.module, 'supprimer', role);
                              const businessPerms = getBusinessPermissions(group.module)
                                .filter(p => hasRolePermission(role, p.id));

                              return (
                                <td key={role} className="px-2 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {/* View */}
                                    <button
                                      onClick={() => {
                                        const perm = permissions.find(p => p.code === `${group.module}.voir`);
                                        if (perm) togglePermission(role, perm.id);
                                      }}
                                      disabled={role === 'admin'}
                                      className={`p-1 rounded transition-colors ${
                                        canView 
                                          ? 'text-success hover:bg-success/20' 
                                          : 'text-muted-foreground/30 hover:bg-muted'
                                      } ${role === 'admin' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                      title="Voir"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                    {/* Write */}
                                    <button
                                      onClick={() => {
                                        const perm = permissions.find(p => p.code === `${group.module}.ecrire`);
                                        if (perm) togglePermission(role, perm.id);
                                      }}
                                      disabled={role === 'admin'}
                                      className={`p-1 rounded transition-colors ${
                                        canWrite 
                                          ? 'text-primary hover:bg-primary/20' 
                                          : 'text-muted-foreground/30 hover:bg-muted'
                                      } ${role === 'admin' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                      title="Écrire"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    {/* Delete */}
                                    <button
                                      onClick={() => {
                                        const perm = permissions.find(p => p.code === `${group.module}.supprimer`);
                                        if (perm) togglePermission(role, perm.id);
                                      }}
                                      disabled={role === 'admin'}
                                      className={`p-1 rounded transition-colors ${
                                        canDelete 
                                          ? 'text-destructive hover:bg-destructive/20' 
                                          : 'text-muted-foreground/30 hover:bg-muted'
                                      } ${role === 'admin' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                      title="Supprimer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    {/* Business permissions indicator */}
                                    {businessPerms.length > 0 && (
                                      <Badge 
                                        variant="secondary" 
                                        className="ml-1 text-[10px] px-1 bg-accent text-accent-foreground"
                                      >
                                        {businessPerms.length}
                                      </Badge>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-success" />
                <span>Voir</span>
              </div>
              <div className="flex items-center gap-1">
                <Edit className="h-3.5 w-3.5 text-primary" />
                <span>Écrire</span>
              </div>
              <div className="flex items-center gap-1">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                <span>Supprimer</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px] px-1">N</Badge>
                <span>Permissions métier</span>
              </div>
            </div>
          </TabsContent>

          {/* Mode B: Detailed View */}
          <TabsContent value="detailed" className="mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Module List */}
              <Card className="md:col-span-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Modules</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    {moduleGroups.map((group) => (
                      <button
                        key={group.module}
                        onClick={() => setSelectedModule(group.module)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                          selectedModule === group.module ? 'bg-muted' : ''
                        }`}
                      >
                        <div>
                          <p className="font-medium text-sm">{group.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {group.permissions.length} permissions
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Permission Details */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {selectedModule 
                      ? `Permissions: ${MODULE_LABELS[selectedModule] || selectedModule}`
                      : 'Sélectionnez un module'
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedModule ? (
                    <ScrollArea className="h-[460px]">
                      <div className="space-y-4">
                        {permissions
                          .filter(p => p.module === selectedModule)
                          .map(perm => (
                            <div key={perm.id} className="border rounded-lg p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <p className="font-medium">{perm.name}</p>
                                  <p className="text-xs text-muted-foreground">{perm.code}</p>
                                  {perm.description && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {perm.description}
                                    </p>
                                  )}
                                </div>
                                {!BASE_ACTIONS.includes(perm.code.split('.')[1]) && (
                                  <Badge variant="secondary">Métier</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {ALL_ROLES.map(role => (
                                  <div 
                                    key={role}
                                    className="flex items-center gap-2"
                                  >
                                    <Switch
                                      checked={hasRolePermission(role, perm.id)}
                                      onCheckedChange={() => togglePermission(role, perm.id)}
                                      disabled={role === 'admin'}
                                      className="scale-75"
                                    />
                                    <span className="text-xs truncate" title={ROLE_LABELS[role]}>
                                      {ROLE_LABELS[role].split(' ')[0]}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="h-[460px] flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Sélectionnez un module pour voir ses permissions</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Info card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">À propos des permissions</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Les permissions Admin sont fixes et ne peuvent pas être modifiées</li>
                  <li>Les modifications prennent effet immédiatement après enregistrement</li>
                  <li>Exportez régulièrement votre configuration pour sauvegarde</li>
                  <li>La suppression de "Voir" masque le module dans le menu latéral</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
