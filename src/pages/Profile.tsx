import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, AppRole } from '@/types/kpm';
import { User, Lock, Building2, Shield, Save, Eye, EyeOff } from 'lucide-react';

export default function Profile() {
  const { user, profile, roles, refreshProfile } = useAuth();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const [form, setForm] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
  });
  
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: form.first_name.trim() || null,
          last_name: form.last_name.trim() || null,
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
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

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Mon profil</h1>
          <p className="text-muted-foreground">Gérez vos informations personnelles</p>
        </div>

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