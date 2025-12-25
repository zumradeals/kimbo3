import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Role } from '@/types/kpm';
import { MODULE_LABELS } from '@/hooks/usePermissions';
import { 
  Shield, Download, RefreshCw, Info, Eye, Edit, Trash2, 
  Plus, Copy, Archive, Settings2
} from 'lucide-react';

interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  description: string | null;
}

interface RolePermissionRow {
  id: string;
  role_id: string | null;
  permission_id: string;
}

interface ModuleGroup {
  module: string;
  label: string;
  permissions: Permission[];
}

const BASE_ACTIONS = ['voir', 'lire', 'ecrire', 'supprimer'];

export default function AdminRoles() {
  const { isAdmin } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, boolean>>(new Map());
  
  // Role CRUD state
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleForm, setRoleForm] = useState({ code: '', label: '', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rolesResult, permsResult, rolePermsResult] = await Promise.all([
        supabase.from('roles').select('*').order('label'),
        supabase.from('permissions').select('*').order('module').order('code'),
        supabase.from('role_permissions').select('id, role_id, permission_id'),
      ]);

      if (rolesResult.error) throw rolesResult.error;
      if (permsResult.error) throw permsResult.error;
      if (rolePermsResult.error) throw rolePermsResult.error;

      setRoles(rolesResult.data || []);
      setPermissions(permsResult.data || []);
      setRolePermissions(rolePermsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
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

  const makePendingKey = (roleId: string, permissionId: string) => `${roleId}::${permissionId}`;

  // Check if a role has a permission
  const hasRolePermission = (roleId: string, permissionId: string): boolean => {
    const key = makePendingKey(roleId, permissionId);
    if (pendingChanges.has(key)) {
      return pendingChanges.get(key)!;
    }
    return rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === permissionId);
  };

  // Toggle permission for a role
  const togglePermission = (role: Role, permissionId: string) => {
    if (role.code === 'admin') {
      toast.error('Les permissions Admin ne peuvent pas être modifiées');
      return;
    }

    const key = makePendingKey(role.id, permissionId);
    const currentValue = hasRolePermission(role.id, permissionId);

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
      const toAdd: { role_id: string; permission_id: string }[] = [];
      const toRemove: { role_id: string; permission_id: string }[] = [];

      pendingChanges.forEach((newValue, key) => {
        const [roleId, permissionId] = key.split('::');
        if (!roleId || !permissionId) return;

        const currentlyHas = rolePermissions.some(
          rp => rp.role_id === roleId && rp.permission_id === permissionId
        );

        if (newValue && !currentlyHas) {
          toAdd.push({ role_id: roleId, permission_id: permissionId });
        } else if (!newValue && currentlyHas) {
          toRemove.push({ role_id: roleId, permission_id: permissionId });
        }
      });

      // Add new permissions
      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('role_permissions')
          .insert(toAdd as any); // Type cast needed until types are regenerated
        if (addError) throw addError;
      }

      // Remove permissions
      for (const item of toRemove) {
        const { error: removeError } = await supabase
          .from('role_permissions')
          .delete()
          .eq('role_id', item.role_id)
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

  const cancelChanges = () => {
    setPendingChanges(new Map());
    toast.info('Modifications annulées');
  };

  // Export configuration
  const exportConfig = () => {
    const config = {
      exportDate: new Date().toISOString(),
      version: '2.0',
      roles: roles.map(r => ({
        code: r.code,
        label: r.label,
        description: r.description,
        is_system: r.is_system,
      })),
      permissions: permissions.map(p => ({
        code: p.code,
        name: p.name,
        module: p.module,
        description: p.description,
      })),
      rolePermissions: roles.reduce((acc, role) => {
        acc[role.code] = permissions
          .filter(p => hasRolePermission(role.id, p.id))
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

  // Get base action permission for a module and role
  const getBasePermission = (module: string, action: string, roleId: string): boolean => {
    const perm = permissions.find(p => p.code === `${module}.${action}`);
    if (!perm) return false;
    return hasRolePermission(roleId, perm.id);
  };

  // Get all business permissions for a module
  const getBusinessPermissions = (module: string): Permission[] => {
    return permissions.filter(p => 
      p.module === module && 
      !BASE_ACTIONS.includes(p.code.split('.')[1])
    );
  };

  // Role CRUD functions
  const openCreateRoleDialog = () => {
    setEditingRole(null);
    setRoleForm({ code: '', label: '', description: '' });
    setShowRoleDialog(true);
  };

  const openEditRoleDialog = (role: Role) => {
    setEditingRole(role);
    setRoleForm({ 
      code: role.code, 
      label: role.label, 
      description: role.description || '' 
    });
    setShowRoleDialog(true);
  };

  const duplicateRole = async (role: Role) => {
    const newCode = `${role.code}_copy`;
    const newLabel = `${role.label} (Copie)`;

    try {
      // Create new role
      const { data: newRole, error: createError } = await supabase
        .from('roles')
        .insert({ code: newCode, label: newLabel, description: role.description })
        .select()
        .single();

      if (createError) throw createError;

      // Copy permissions
      const rolePerm = rolePermissions.filter(rp => rp.role_id === role.id);
      if (rolePerm.length > 0) {
        const newPerms = rolePerm.map(rp => ({
          role_id: newRole.id,
          permission_id: rp.permission_id,
        }));
        await supabase.from('role_permissions').insert(newPerms as any);
      }

      toast.success(`Rôle "${newLabel}" créé avec succès`);
      await fetchData();
    } catch (error) {
      console.error('Error duplicating role:', error);
      toast.error('Erreur lors de la duplication');
    }
  };

  const archiveRole = async (role: Role) => {
    if (role.is_system) {
      toast.error('Les rôles système ne peuvent pas être archivés');
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir archiver le rôle "${role.label}" ?`)) return;

    try {
      const { error } = await supabase
        .from('roles')
        .update({ is_active: false })
        .eq('id', role.id);

      if (error) throw error;
      toast.success(`Rôle "${role.label}" archivé`);
      await fetchData();
    } catch (error) {
      console.error('Error archiving role:', error);
      toast.error('Erreur lors de l\'archivage');
    }
  };

  const saveRole = async () => {
    if (!roleForm.code.trim() || !roleForm.label.trim()) {
      toast.error('Le code et le libellé sont obligatoires');
      return;
    }

    try {
      if (editingRole) {
        // Update existing role
        if (editingRole.is_system && editingRole.code !== roleForm.code) {
          toast.error('Le code d\'un rôle système ne peut pas être modifié');
          return;
        }

        const { error } = await supabase
          .from('roles')
          .update({ 
            code: roleForm.code, 
            label: roleForm.label, 
            description: roleForm.description || null 
          })
          .eq('id', editingRole.id);

        if (error) throw error;
        toast.success('Rôle modifié avec succès');
      } else {
        // Create new role
        const { error } = await supabase
          .from('roles')
          .insert({ 
            code: roleForm.code, 
            label: roleForm.label, 
            description: roleForm.description || null 
          });

        if (error) throw error;
        toast.success('Rôle créé avec succès');
      }

      setShowRoleDialog(false);
      await fetchData();
    } catch (error: any) {
      console.error('Error saving role:', error);
      if (error.code === '23505') {
        toast.error('Ce code de rôle existe déjà');
      } else {
        toast.error('Erreur lors de l\'enregistrement');
      }
    }
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

  const activeRoles = roles.filter(r => r.is_active);

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
              {roles.length} rôles, {permissions.length} permissions
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openCreateRoleDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau rôle
            </Button>
            <Button variant="outline" size="sm" onClick={exportConfig}>
              <Download className="mr-2 h-4 w-4" />
              Exporter
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Actualiser
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

        <Tabs defaultValue="roles" className="w-full">
          <TabsList>
            <TabsTrigger value="roles">Gestion des rôles</TabsTrigger>
            <TabsTrigger value="matrix">Matrice des permissions</TabsTrigger>
            <TabsTrigger value="detailed">Détails par module</TabsTrigger>
          </TabsList>

          {/* Tab: Role Management */}
          <TabsContent value="roles" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => (
                <Card key={role.id} className={!role.is_active ? 'opacity-60' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {role.label}
                          {role.is_system && (
                            <Badge variant="secondary" className="text-[10px]">Système</Badge>
                          )}
                          {!role.is_active && (
                            <Badge variant="outline" className="text-[10px]">Archivé</Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Code: {role.code}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => openEditRoleDialog(role)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => duplicateRole(role)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {!role.is_system && role.is_active && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => archiveRole(role)}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {role.description || 'Aucune description'}
                    </p>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {rolePermissions.filter(rp => rp.role_id === role.id).length} permissions
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tab: Quick Matrix */}
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
                      Cliquez sur une icône pour activer/désactiver la permission
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <div className="min-w-[900px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-medium w-48">
                            Module
                          </th>
                          {activeRoles.map((role) => (
                            <th
                              key={role.id}
                              className="min-w-[80px] px-2 py-3 text-center text-xs font-medium"
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="whitespace-nowrap">
                                  {role.label.split(' ').slice(0, 2).join(' ')}
                                </span>
                                {role.code === 'admin' && (
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
                            {activeRoles.map((role) => {
                              const canView = getBasePermission(group.module, 'voir', role.id);
                              const canWrite = getBasePermission(group.module, 'ecrire', role.id);
                              const canDelete = getBasePermission(group.module, 'supprimer', role.id);
                              const businessPerms = getBusinessPermissions(group.module)
                                .filter(p => hasRolePermission(role.id, p.id));

                              return (
                                <td key={role.id} className="px-2 py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {/* View */}
                                    <button
                                      onClick={() => {
                                        const perm = permissions.find(p => p.code === `${group.module}.voir`);
                                        if (perm) togglePermission(role, perm.id);
                                      }}
                                      disabled={role.code === 'admin'}
                                      className={`p-1 rounded transition-colors ${
                                        canView 
                                          ? 'text-success hover:bg-success/20' 
                                          : 'text-muted-foreground/30 hover:bg-muted'
                                      } ${role.code === 'admin' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
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
                                      disabled={role.code === 'admin'}
                                      className={`p-1 rounded transition-colors ${
                                        canWrite 
                                          ? 'text-primary hover:bg-primary/20' 
                                          : 'text-muted-foreground/30 hover:bg-muted'
                                      } ${role.code === 'admin' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
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
                                      disabled={role.code === 'admin'}
                                      className={`p-1 rounded transition-colors ${
                                        canDelete 
                                          ? 'text-destructive hover:bg-destructive/20' 
                                          : 'text-muted-foreground/30 hover:bg-muted'
                                      } ${role.code === 'admin' ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                      title="Supprimer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    {/* Business permissions indicator */}
                                    {businessPerms.length > 0 && (
                                      <Badge 
                                        variant="secondary" 
                                        className="text-[9px] px-1 ml-1"
                                        title={businessPerms.map(p => p.name).join(', ')}
                                      >
                                        +{businessPerms.length}
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
          </TabsContent>

          {/* Tab: Detailed View */}
          <TabsContent value="detailed" className="mt-4">
            <div className="grid gap-4">
              {moduleGroups.map((group) => (
                <Card key={group.module}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Settings2 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-base">{group.label}</CardTitle>
                        <CardDescription className="text-xs">
                          {group.permissions.length} permissions
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {group.permissions.map((perm) => (
                        <div key={perm.id} className="border-b pb-3 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium text-sm">{perm.name}</span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({perm.code})
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {activeRoles.map((role) => (
                              <div key={role.id} className="flex items-center gap-2">
                                <Switch
                                  checked={hasRolePermission(role.id, perm.id)}
                                  onCheckedChange={() => togglePermission(role, perm.id)}
                                  disabled={role.code === 'admin'}
                                />
                                <span className="text-xs text-muted-foreground">
                                  {role.label.split(' ')[0]}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRole ? 'Modifier le rôle' : 'Créer un nouveau rôle'}
            </DialogTitle>
            <DialogDescription>
              {editingRole 
                ? 'Modifiez les informations du rôle'
                : 'Renseignez les informations du nouveau rôle'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role-code">Code (identifiant unique)</Label>
              <Input
                id="role-code"
                value={roleForm.code}
                onChange={(e) => setRoleForm(prev => ({ ...prev, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                placeholder="ex: chef_projet"
                disabled={editingRole?.is_system}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-label">Libellé</Label>
              <Input
                id="role-label"
                value={roleForm.label}
                onChange={(e) => setRoleForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="ex: Chef de Projet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={roleForm.description}
                onChange={(e) => setRoleForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description du rôle..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Annuler
            </Button>
            <Button onClick={saveRole}>
              {editingRole ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}