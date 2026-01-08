import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, AppRole } from '@/types/kpm';
import { User, Lock, Building2, Shield, Save, Eye, EyeOff, Camera, Upload, UserCheck, Briefcase } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { UserBadge } from '@/components/ui/UserBadge';
import { Link } from 'react-router-dom';

const POSITION_LABELS: Record<string, string> = {
  membre: 'Membre',
  chef_departement: 'Chef de département',
  adjoint: 'Adjoint',
};

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  actif: { label: 'Actif', variant: 'default' },
  interim: { label: 'Intérim', variant: 'secondary' },
  absent: { label: 'Absent', variant: 'outline' },
};

interface ChefHierarchique {
  id: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  fonction: string | null;
  department?: { name: string } | null;
}

export default function Profile() {
  const { user, profile, roles, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [chefHierarchique, setChefHierarchique] = useState<ChefHierarchique | null>(null);
  
  const [extendedProfile, setExtendedProfile] = useState<{
    photo_url: string | null;
    fonction: string | null;
    position_departement: string | null;
    statut_utilisateur: string | null;
    chef_hierarchique_id: string | null;
  }>({
    photo_url: null,
    fonction: null,
    position_departement: 'membre',
    statut_utilisateur: 'actif',
    chef_hierarchique_id: null,
  });
  
  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    fonction: '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (user) {
      fetchExtendedProfile();
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        fonction: extendedProfile.fonction || '',
      });
    }
  }, [profile, extendedProfile]);

  const fetchExtendedProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('photo_url, fonction, position_departement, statut_utilisateur, chef_hierarchique_id')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExtendedProfile({
          photo_url: data.photo_url,
          fonction: data.fonction,
          position_departement: data.position_departement,
          statut_utilisateur: data.statut_utilisateur,
          chef_hierarchique_id: data.chef_hierarchique_id,
        });
        setForm(prev => ({ ...prev, fonction: data.fonction || '' }));

        // Fetch chef hiérarchique if exists
        if (data.chef_hierarchique_id) {
          const { data: chefData } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, photo_url, fonction, department:departments(name)')
            .eq('id', data.chef_hierarchique_id)
            .maybeSingle();

          if (chefData) {
            setChefHierarchique(chefData as ChefHierarchique);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching extended profile:', error);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner une image.', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Erreur', description: 'L\'image ne doit pas dépasser 5 Mo.', variant: 'destructive' });
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Delete old photo if exists
      if (extendedProfile.photo_url) {
        const oldPath = extendedProfile.photo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('profile-photos').remove([oldPath]);
      }

      // Upload new photo
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setExtendedProfile(prev => ({ ...prev, photo_url: publicUrl }));
      toast({ title: 'Photo mise à jour', description: 'Votre photo de profil a été enregistrée.' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name.trim() || null,
          last_name: form.last_name.trim() || null,
          fonction: form.fonction.trim() || null,
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      setExtendedProfile(prev => ({ ...prev, fonction: form.fonction.trim() || null }));
      toast({ title: 'Profil mis à jour', description: 'Vos informations ont été enregistrées.' });
      setIsEditing(false);
      await refreshProfile();
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({ 
        title: 'Erreur', 
        description: 'Les mots de passe ne correspondent pas.', 
        variant: 'destructive' 
      });
      return;
    }
    
    if (passwordForm.new_password.length < 6) {
      toast({ 
        title: 'Erreur', 
        description: 'Le mot de passe doit contenir au moins 6 caractères.', 
        variant: 'destructive' 
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.new_password,
      });
      
      if (error) throw error;
      
      toast({ title: 'Mot de passe modifié', description: 'Votre mot de passe a été mis à jour.' });
      setIsChangingPassword(false);
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const statusInfo = STATUS_LABELS[extendedProfile.statut_utilisateur || 'actif'] || STATUS_LABELS.actif;

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header with Photo */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Photo */}
              <div className="relative">
                <UserAvatar
                  photoUrl={extendedProfile.photo_url}
                  firstName={profile?.first_name}
                  lastName={profile?.last_name}
                  size="xl"
                  className="h-24 w-24"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                >
                  {isUploadingPhoto ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                />
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-foreground">
                  {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Mon profil'}
                </h1>
                {extendedProfile.fonction && (
                  <p className="text-muted-foreground flex items-center gap-2 justify-center sm:justify-start mt-1">
                    <Briefcase className="h-4 w-4" />
                    {extendedProfile.fonction}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-2 justify-center sm:justify-start">
                  {profile?.department?.name && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {profile.department.name}
                    </Badge>
                  )}
                  {extendedProfile.position_departement && (
                    <Badge variant="secondary">
                      {POSITION_LABELS[extendedProfile.position_departement] || extendedProfile.position_departement}
                    </Badge>
                  )}
                  <Badge variant={statusInfo.variant}>
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chef hiérarchique */}
        {chefHierarchique && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">Chef hiérarchique</CardTitle>
                  <CardDescription>Votre supérieur direct</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <UserBadge
                userId={chefHierarchique.id}
                photoUrl={chefHierarchique.photo_url}
                firstName={chefHierarchique.first_name}
                lastName={chefHierarchique.last_name}
                fonction={chefHierarchique.fonction}
                departmentName={chefHierarchique.department?.name}
                showFonction
                showDepartment
                size="lg"
                linkToProfile
              />
            </CardContent>
          </Card>
        )}

        {/* Informations personnelles */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Informations personnelles</CardTitle>
                  <CardDescription>Vos informations de base</CardDescription>
                </div>
              </div>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  Modifier
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ''} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">L'email ne peut pas être modifié</p>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">Prénom</Label>
                <Input
                  id="first_name"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Votre prénom"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="last_name">Nom</Label>
                <Input
                  id="last_name"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Votre nom"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fonction">Fonction</Label>
              <Input
                id="fonction"
                value={form.fonction}
                onChange={(e) => setForm({ ...form, fonction: e.target.value })}
                disabled={!isEditing}
                placeholder="Votre fonction (ex: Ingénieur, Chef de projet...)"
              />
            </div>
            
            {isEditing && (
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSaveProfile} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditing(false);
                    setForm({
                      first_name: profile?.first_name || '',
                      last_name: profile?.last_name || '',
                      fonction: extendedProfile.fonction || '',
                    });
                  }}
                >
                  Annuler
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Département & Rôles (lecture seule) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Département & Rôles</CardTitle>
                <CardDescription>Ces informations sont gérées par l'administration</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Département</Label>
              <Input 
                value={profile?.department?.name || 'Non assigné'} 
                disabled 
                className="bg-muted" 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Rôles</Label>
              <div className="flex flex-wrap gap-2">
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <div
                      key={role}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary"
                    >
                      <Shield className="h-3 w-3" />
                      {ROLE_LABELS[role as AppRole] || role}
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Aucun rôle assigné</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Les rôles sont attribués par un administrateur
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sécurité */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle>Sécurité</CardTitle>
                  <CardDescription>Gérez votre mot de passe</CardDescription>
                </div>
              </div>
              {!isChangingPassword && (
                <Button variant="outline" size="sm" onClick={() => setIsChangingPassword(true)}>
                  Changer le mot de passe
                </Button>
              )}
            </div>
          </CardHeader>
          {isChangingPassword && (
            <CardContent className="space-y-4">
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="new_password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    placeholder="Minimum 6 caractères"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirmer le nouveau mot de passe</Label>
                <Input
                  id="confirm_password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordForm.confirm_password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                  placeholder="Répétez le mot de passe"
                />
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button onClick={handleChangePassword} disabled={isSaving}>
                  {isSaving ? 'Enregistrement...' : 'Mettre à jour'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
                  }}
                >
                  Annuler
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
