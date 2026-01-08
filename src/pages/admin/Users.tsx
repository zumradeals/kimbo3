import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AppRole, Department, Profile, ROLE_LABELS, STATUS_LABELS, UserStatus, PositionDepartement, StatutUtilisateur } from '@/types/kpm';
import { Plus, Pencil, Trash2, Search, Mail, Key } from 'lucide-react';

const ALL_ROLES: AppRole[] = [
  'admin', 'dg', 'daf', 'comptable', 'responsable_logistique',
  'agent_logistique', 'responsable_achats', 'agent_achats',
  'responsable_departement', 'employe', 'lecture_seule'
];

interface UserWithRoles extends Omit<Profile, 'position_departement' | 'statut_utilisateur'> {
  roles: AppRole[];
  position_departement?: string | null;
  statut_utilisateur?: string | null;
}

export default function AdminUsers() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Edit modal
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    department_id: '',
    status: 'active' as UserStatus,
    roles: ['employe'] as AppRole[],
  });
  const [isSaving, setIsSaving] = useState(false);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    department_id: '',
    roles: ['employe'] as AppRole[],
  });
  const [isCreating, setIsCreating] = useState(false);

  // Delete confirmation
  const [userToDelete, setUserToDelete] = useState<UserWithRoles | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin actions modal
  const [showAdminActionModal, setShowAdminActionModal] = useState(false);
  const [adminActionUser, setAdminActionUser] = useState<UserWithRoles | null>(null);
  const [adminActionType, setAdminActionType] = useState<'email' | 'password'>('email');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [adminActionReason, setAdminActionReason] = useState('');
  const [isAdminActing, setIsAdminActing] = useState(false);

  const handleDelete = async () => {
    if (!userToDelete) return;
    
    setIsDeleting(true);

    try {
      const response = await supabase.functions.invoke('delete-user', {
        body: { user_id: userToDelete.id },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error || 'Erreur lors de la suppression');

      toast({ title: 'Utilisateur supprimé', description: `${userToDelete.first_name} ${userToDelete.last_name} a été supprimé.` });
      setUserToDelete(null);
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAdminAction = async () => {
    if (!adminActionUser || !adminActionReason.trim()) return;
    setIsAdminActing(true);

    try {
      const body: any = { user_id: adminActionUser.id, reason: adminActionReason.trim() };
      if (adminActionType === 'email' && newEmail) body.email = newEmail;
      if (adminActionType === 'password' && newPassword) body.password = newPassword;

      const response = await supabase.functions.invoke('admin-update-user', { body });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error || 'Erreur');

      toast({ 
        title: adminActionType === 'email' ? 'Email modifié' : 'Mot de passe réinitialisé',
        description: `Action effectuée pour ${adminActionUser.first_name} ${adminActionUser.last_name}.`
      });
      closeAdminActionModal();
      fetchData();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsAdminActing(false);
    }
  };

  const openAdminActionModal = (userToEdit: UserWithRoles, type: 'email' | 'password') => {
    setAdminActionUser(userToEdit);
    setAdminActionType(type);
    setNewEmail(type === 'email' ? userToEdit.email : '');
    setNewPassword('');
    setAdminActionReason('');
    setShowAdminActionModal(true);
  };

  const closeAdminActionModal = () => {
    setShowAdminActionModal(false);
    setAdminActionUser(null);
    setNewEmail('');
    setNewPassword('');
    setAdminActionReason('');
  };

  const fetchData = async () => {
    try {
      // Fetch departments
      const { data: deptData } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      setDepartments(deptData || []);

      // Fetch profiles with department info
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*, department:departments(*)')
        .order('created_at', { ascending: false });

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        return;
      }

      // Fetch all user roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
      }

      // Map roles to users
      const usersWithRoles: UserWithRoles[] = (profilesData || []).map((profile) => {
        const userRoles = (rolesData || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole);
        return { ...profile, roles: userRoles };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const openEditModal = (userToEdit: UserWithRoles) => {
    setEditingUser(userToEdit);
    setEditForm({
      first_name: userToEdit.first_name || '',
      last_name: userToEdit.last_name || '',
      department_id: userToEdit.department_id || '',
      status: userToEdit.status,
      roles: userToEdit.roles.length > 0 ? userToEdit.roles : ['employe'],
    });
  };

  const resetCreateForm = () => {
    setCreateForm({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      department_id: '',
      roles: ['employe'],
    });
  };

  const toggleRole = (role: AppRole, formType: 'edit' | 'create') => {
    if (formType === 'edit') {
      const currentRoles = editForm.roles;
      if (currentRoles.includes(role)) {
        if (currentRoles.length > 1) {
          setEditForm({ ...editForm, roles: currentRoles.filter(r => r !== role) });
        }
      } else {
        setEditForm({ ...editForm, roles: [...currentRoles, role] });
      }
    } else {
      const currentRoles = createForm.roles;
      if (currentRoles.includes(role)) {
        if (currentRoles.length > 1) {
          setCreateForm({ ...createForm, roles: currentRoles.filter(r => r !== role) });
        }
      } else {
        setCreateForm({ ...createForm, roles: [...currentRoles, role] });
      }
    }
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password || !createForm.first_name || !createForm.last_name) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires.',
        variant: 'destructive',
      });
      return;
    }

    if (createForm.password.length < 6) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 6 caractères.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email: createForm.email,
          password: createForm.password,
          first_name: createForm.first_name,
          last_name: createForm.last_name,
          department_id: createForm.department_id || null,
          roles: createForm.roles,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data.success) {
        throw new Error(response.data.error || 'Erreur lors de la création');
      }

      toast({
        title: 'Utilisateur créé',
        description: `${createForm.first_name} ${createForm.last_name} a été créé avec succès.`,
      });

      setIsCreateOpen(false);
      resetCreateForm();
      fetchData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer l\'utilisateur.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };
  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm({
      first_name: '',
      last_name: '',
      department_id: '',
      status: 'active',
      roles: ['employe'],
    });
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          department_id: editForm.department_id || null,
          status: editForm.status,
        })
        .eq('id', editingUser.id);

      if (profileError) {
        throw profileError;
      }

      // Update roles - delete existing and insert new ones
      const { error: deleteRoleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.id);

      if (deleteRoleError) {
        throw deleteRoleError;
      }

      // Insert all selected roles
      const rolesToInsert = editForm.roles.map(role => ({
        user_id: editingUser.id,
        role,
        assigned_by: user?.id,
      }));

      const { error: insertRoleError } = await supabase
        .from('user_roles')
        .insert(rolesToInsert);

      if (insertRoleError) {
        throw insertRoleError;
      }

      toast({
        title: 'Utilisateur mis à jour',
        description: `Les informations de ${editForm.first_name} ${editForm.last_name} ont été enregistrées.`,
      });

      closeEditModal();
      fetchData();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder les modifications.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const search = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(search) ||
      (u.first_name?.toLowerCase() || '').includes(search) ||
      (u.last_name?.toLowerCase() || '').includes(search)
    );
  });

  if (!isAdmin) {
    return (
      <AppLayout>
        <AccessDenied message="Seuls les administrateurs peuvent gérer les utilisateurs." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Gestion des utilisateurs
            </h1>
            <p className="text-muted-foreground">
              {users.length} utilisateur(s) enregistré(s)
            </p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Nouvel utilisateur
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Users table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchQuery ? 'Aucun utilisateur trouvé.' : 'Aucun utilisateur enregistré.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Département</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {u.first_name} {u.last_name}
                            </p>
                            <p className="text-sm text-muted-foreground">{u.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.department?.name || (
                            <span className="text-muted-foreground">Non assigné</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((role) => (
                              <span
                                key={role}
                                className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                              >
                                {ROLE_LABELS[role]}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                              u.status === 'active'
                                ? 'bg-success/10 text-success'
                                : u.status === 'suspended'
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {STATUS_LABELS[u.status]}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditModal(u)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openAdminActionModal(u, 'email')} disabled={u.id === user?.id}>
                              <Mail className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openAdminActionModal(u, 'password')}>
                              <Key className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setUserToDelete(u)}
                              disabled={u.id === user?.id}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && closeEditModal()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-serif">Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations, le rôle et le département de l'utilisateur.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom</Label>
                <Input
                  id="first_name"
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom</Label>
                <Input
                  id="last_name"
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Département</Label>
              <Select
                value={editForm.department_id || "none"}
                onValueChange={(value) => setEditForm({ ...editForm, department_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un département" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun département</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rôles (sélection multiple)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {ALL_ROLES.map((role) => (
                  <label
                    key={role}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                      editForm.roles.includes(role) 
                        ? 'bg-primary/10 border border-primary' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={editForm.roles.includes(role)}
                      onChange={() => toggleRole(role, 'edit')}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm">{ROLE_LABELS[role]}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {editForm.roles.length} rôle(s) sélectionné(s)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm({ ...editForm, status: value as UserStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                  <SelectItem value="suspended">Suspendu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal} disabled={isSaving}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) resetCreateForm();
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-serif">Créer un utilisateur</DialogTitle>
            <DialogDescription>
              Remplissez les informations pour créer un nouvel utilisateur.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create_email">Email *</Label>
              <Input
                id="create_email"
                type="email"
                placeholder="email@exemple.com"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create_password">Mot de passe * (min. 6 caractères)</Label>
              <Input
                id="create_password"
                type="password"
                placeholder="••••••••"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create_first_name">Prénom *</Label>
                <Input
                  id="create_first_name"
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_last_name">Nom *</Label>
                <Input
                  id="create_last_name"
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create_department">Département</Label>
              <Select
                value={createForm.department_id || "none"}
                onValueChange={(value) => setCreateForm({ ...createForm, department_id: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un département" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun département</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rôles * (sélection multiple)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-3">
                {ALL_ROLES.map((role) => (
                  <label
                    key={role}
                    className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                      createForm.roles.includes(role) 
                        ? 'bg-primary/10 border border-primary' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={createForm.roles.includes(role)}
                      onChange={() => toggleRole(role, 'create')}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm">{ROLE_LABELS[role]}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {createForm.roles.length} rôle(s) sélectionné(s)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Création...' : 'Créer l\'utilisateur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{userToDelete?.first_name} {userToDelete?.last_name}</strong> ({userToDelete?.email}) ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
      </AlertDialogContent>
      </AlertDialog>

      {/* Admin Action Modal (Email/Password) */}
      <Dialog open={showAdminActionModal} onOpenChange={(open) => !open && closeAdminActionModal()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {adminActionType === 'email' ? 'Modifier l\'email' : 'Réinitialiser le mot de passe'}
            </DialogTitle>
            <DialogDescription>
              {adminActionType === 'email' 
                ? `Modifier l'adresse email de ${adminActionUser?.first_name} ${adminActionUser?.last_name}.`
                : `Définir un nouveau mot de passe pour ${adminActionUser?.first_name} ${adminActionUser?.last_name}.`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {adminActionType === 'email' ? (
              <div className="space-y-2">
                <Label htmlFor="new_email">Nouvel email</Label>
                <Input
                  id="new_email"
                  type="email"
                  placeholder="nouveau@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="new_password">Nouveau mot de passe (min. 6 caractères)</Label>
                <Input
                  id="new_password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin_reason">Motif de l'action (obligatoire)</Label>
              <Input
                id="admin_reason"
                placeholder="Ex: Demande de l'utilisateur, correction d'erreur..."
                value={adminActionReason}
                onChange={(e) => setAdminActionReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cette action sera journalisée avec le motif indiqué.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeAdminActionModal} disabled={isAdminActing}>
              Annuler
            </Button>
            <Button 
              onClick={handleAdminAction} 
              disabled={isAdminActing || !adminActionReason.trim() || (adminActionType === 'email' ? !newEmail : !newPassword || newPassword.length < 6)}
            >
              {isAdminActing ? 'En cours...' : (adminActionType === 'email' ? 'Modifier l\'email' : 'Réinitialiser')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
