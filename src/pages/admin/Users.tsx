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
import { AppRole, Department, Profile, ROLE_LABELS, STATUS_LABELS, UserStatus, PositionDepartement, StatutUtilisateur, POSITION_DEPARTEMENT_LABELS, STATUT_UTILISATEUR_LABELS } from '@/types/kpm';
import { Plus, Pencil, Trash2, Search, Mail, Key, Upload, X, User } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';

const ALL_ROLES: AppRole[] = [
  'admin', 'dg', 'daf', 'aal', 'comptable', 'responsable_logistique',
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
  
  // Liste des utilisateurs pour le chef hiérarchique
  const [allUsers, setAllUsers] = useState<Profile[]>([]);

  // Edit modal
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    department_id: '',
    status: 'active' as UserStatus,
    roles: ['employe'] as AppRole[],
    fonction: '',
    chef_hierarchique_id: '',
    position_departement: '' as PositionDepartement | '',
    statut_utilisateur: '' as StatutUtilisateur | '',
    photo_url: '' as string | null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    department_id: '',
    roles: ['employe'] as AppRole[],
    fonction: '',
    chef_hierarchique_id: '',
    position_departement: '' as PositionDepartement | '',
    statut_utilisateur: '' as StatutUtilisateur | '',
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createPhotoFile, setCreatePhotoFile] = useState<File | null>(null);
  const [createPhotoPreview, setCreatePhotoPreview] = useState<string | null>(null);

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

      // Store all users for chef hiérarchique selection
      setAllUsers((profilesData || []).map(p => ({
        id: p.id,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        department_id: p.department_id,
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
        department: p.department,
      })));

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
      fonction: (userToEdit as any).fonction || '',
      chef_hierarchique_id: (userToEdit as any).chef_hierarchique_id || '',
      position_departement: (userToEdit as any).position_departement || '',
      statut_utilisateur: (userToEdit as any).statut_utilisateur || '',
      photo_url: userToEdit.photo_url || null,
    });
    setEditPhotoPreview(userToEdit.photo_url || null);
    setEditPhotoFile(null);
  };

  const resetCreateForm = () => {
    setCreateForm({
      email: '',
      password: '',
      first_name: '',
      last_name: '',
      department_id: '',
      roles: ['employe'],
      fonction: '',
      chef_hierarchique_id: '',
      position_departement: '',
      statut_utilisateur: '',
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
          fonction: createForm.fonction || null,
          chef_hierarchique_id: createForm.chef_hierarchique_id || null,
          position_departement: createForm.position_departement || null,
          statut_utilisateur: createForm.statut_utilisateur || null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (!response.data.success) {
        throw new Error(response.data.error || 'Erreur lors de la création');
      }

      const newUserId = response.data.user.id;

      // Upload photo if provided
      if (createPhotoFile && newUserId) {
        const photoUrl = await uploadPhoto(createPhotoFile, newUserId);
        if (photoUrl) {
          await supabase
            .from('profiles')
            .update({ photo_url: photoUrl })
            .eq('id', newUserId);
        }
      }

      toast({
        title: 'Utilisateur créé',
        description: `${createForm.first_name} ${createForm.last_name} a été créé avec succès.`,
      });

      setIsCreateOpen(false);
      resetCreateForm();
      setCreatePhotoFile(null);
      setCreatePhotoPreview(null);
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
      fonction: '',
      chef_hierarchique_id: '',
      position_departement: '',
      statut_utilisateur: '',
      photo_url: null,
    });
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
  };

  const handlePhotoChange = (file: File | null, type: 'edit' | 'create') => {
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'edit') {
          setEditPhotoPreview(reader.result as string);
          setEditPhotoFile(file);
        } else {
          setCreatePhotoPreview(reader.result as string);
          setCreatePhotoFile(file);
        }
      };
      reader.readAsDataURL(file);
    } else {
      if (type === 'edit') {
        setEditPhotoPreview(editForm.photo_url);
        setEditPhotoFile(null);
      } else {
        setCreatePhotoPreview(null);
        setCreatePhotoFile(null);
      }
    }
  };

  const uploadPhoto = async (file: File, userId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data: publicUrl } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(filePath);

    return publicUrl.publicUrl;
  };

  const handleSave = async () => {
    if (!editingUser) return;
    setIsSaving(true);

    try {
      let photoUrl = editForm.photo_url;

      // Upload new photo if selected
      if (editPhotoFile) {
        photoUrl = await uploadPhoto(editPhotoFile, editingUser.id);
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          department_id: editForm.department_id || null,
          status: editForm.status,
          fonction: editForm.fonction || null,
          chef_hierarchique_id: editForm.chef_hierarchique_id || null,
          position_departement: editForm.position_departement || null,
          statut_utilisateur: editForm.statut_utilisateur || null,
          photo_url: photoUrl,
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Modifier l'utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations, le rôle et le département de l'utilisateur.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Photo de profil</Label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {editPhotoPreview ? (
                    <img
                      src={editPhotoPreview}
                      alt="Preview"
                      className="h-20 w-20 rounded-lg object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed border-border">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="relative"
                      onClick={() => document.getElementById('edit-photo-input')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choisir une photo
                    </Button>
                    {editPhotoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditPhotoFile(null);
                          setEditPhotoPreview(null);
                          setEditForm({ ...editForm, photo_url: null });
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Supprimer
                      </Button>
                    )}
                  </div>
                  <input
                    id="edit-photo-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoChange(e.target.files?.[0] || null, 'edit')}
                  />
                  <p className="text-xs text-muted-foreground">JPG, PNG ou GIF. Max 5 Mo.</p>
                </div>
              </div>
            </div>

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
              <Label htmlFor="edit_fonction">Fonction / Poste</Label>
              <Input
                id="edit_fonction"
                placeholder="Ex: Directeur Commercial, Ingénieur BTP..."
                value={editForm.fonction}
                onChange={(e) => setEditForm({ ...editForm, fonction: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="edit_position">Position dans le département</Label>
                <Select
                  value={editForm.position_departement || "none"}
                  onValueChange={(value) => setEditForm({ ...editForm, position_departement: value === "none" ? "" : value as PositionDepartement })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    <SelectItem value="membre">{POSITION_DEPARTEMENT_LABELS.membre}</SelectItem>
                    <SelectItem value="adjoint">{POSITION_DEPARTEMENT_LABELS.adjoint}</SelectItem>
                    <SelectItem value="chef_departement">{POSITION_DEPARTEMENT_LABELS.chef_departement}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_chef">Chef hiérarchique</Label>
                <Select
                  value={editForm.chef_hierarchique_id || "none"}
                  onValueChange={(value) => setEditForm({ ...editForm, chef_hierarchique_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un chef" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {allUsers
                      .filter(u => u.id !== editingUser?.id)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.first_name} {u.last_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_statut_utilisateur">Statut utilisateur</Label>
                <Select
                  value={editForm.statut_utilisateur || "none"}
                  onValueChange={(value) => setEditForm({ ...editForm, statut_utilisateur: value === "none" ? "" : value as StatutUtilisateur })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    <SelectItem value="actif">{STATUT_UTILISATEUR_LABELS.actif}</SelectItem>
                    <SelectItem value="interim">{STATUT_UTILISATEUR_LABELS.interim}</SelectItem>
                    <SelectItem value="absent">{STATUT_UTILISATEUR_LABELS.absent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rôles (sélection multiple)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
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
              <Label htmlFor="status">Statut du compte</Label>
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
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

            {/* Photo Upload */}
            <div className="space-y-2">
              <Label>Photo de profil</Label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {createPhotoPreview ? (
                    <img
                      src={createPhotoPreview}
                      alt="Preview"
                      className="h-20 w-20 rounded-lg object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center border-2 border-dashed border-border">
                      <User className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="relative"
                      onClick={() => document.getElementById('create-photo-input')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choisir une photo
                    </Button>
                    {createPhotoPreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCreatePhotoFile(null);
                          setCreatePhotoPreview(null);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Supprimer
                      </Button>
                    )}
                  </div>
                  <input
                    id="create-photo-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoChange(e.target.files?.[0] || null, 'create')}
                  />
                  <p className="text-xs text-muted-foreground">JPG, PNG ou GIF. Max 5 Mo.</p>
                </div>
              </div>
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
              <Label htmlFor="create_fonction">Fonction / Poste</Label>
              <Input
                id="create_fonction"
                placeholder="Ex: Directeur Commercial, Ingénieur BTP..."
                value={createForm.fonction}
                onChange={(e) => setCreateForm({ ...createForm, fonction: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <Label htmlFor="create_position">Position dans le département</Label>
                <Select
                  value={createForm.position_departement || "none"}
                  onValueChange={(value) => setCreateForm({ ...createForm, position_departement: value === "none" ? "" : value as PositionDepartement })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    <SelectItem value="membre">{POSITION_DEPARTEMENT_LABELS.membre}</SelectItem>
                    <SelectItem value="adjoint">{POSITION_DEPARTEMENT_LABELS.adjoint}</SelectItem>
                    <SelectItem value="chef_departement">{POSITION_DEPARTEMENT_LABELS.chef_departement}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create_chef">Chef hiérarchique</Label>
                <Select
                  value={createForm.chef_hierarchique_id || "none"}
                  onValueChange={(value) => setCreateForm({ ...createForm, chef_hierarchique_id: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un chef" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.first_name} {u.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create_statut_utilisateur">Statut utilisateur</Label>
                <Select
                  value={createForm.statut_utilisateur || "none"}
                  onValueChange={(value) => setCreateForm({ ...createForm, statut_utilisateur: value === "none" ? "" : value as StatutUtilisateur })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non défini</SelectItem>
                    <SelectItem value="actif">{STATUT_UTILISATEUR_LABELS.actif}</SelectItem>
                    <SelectItem value="interim">{STATUT_UTILISATEUR_LABELS.interim}</SelectItem>
                    <SelectItem value="absent">{STATUT_UTILISATEUR_LABELS.absent}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Rôles * (sélection multiple)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
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
