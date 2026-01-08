import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Mail, Building2, Briefcase, Users, User } from 'lucide-react';
import { ROLE_LABELS, AppRole } from '@/types/kpm';

interface UserProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  photo_url: string | null;
  fonction: string | null;
  position_departement: string | null;
  statut_utilisateur: string | null;
  department: {
    id: string;
    name: string;
  } | null;
  chef_hierarchique: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
    fonction: string | null;
  } | null;
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      
      setIsLoading(true);
      try {
        // Use RPC function to bypass RLS and get public profile data
        const { data: publicProfiles, error: rpcError } = await supabase
          .rpc('get_public_profiles', { _user_ids: [id] });

        if (rpcError) throw rpcError;
        
        if (!publicProfiles || publicProfiles.length === 0) {
          setProfile(null);
          return;
        }

        const publicProfile = publicProfiles[0];

        // Also fetch additional profile data that the user can see
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            photo_url,
            fonction,
            position_departement,
            statut_utilisateur,
            chef_hierarchique_id,
            department:departments(id, name)
          `)
          .eq('id', id)
          .maybeSingle();

        // Fetch chef hierarchique info if exists
        let chefData = null;
        if (profileData?.chef_hierarchique_id) {
          const { data: chefProfiles } = await supabase
            .rpc('get_public_profiles', { _user_ids: [profileData.chef_hierarchique_id] });
          
          if (chefProfiles && chefProfiles.length > 0) {
            const { data: chefPhoto } = await supabase
              .from('profiles')
              .select('photo_url, fonction')
              .eq('id', profileData.chef_hierarchique_id)
              .maybeSingle();
            
            chefData = {
              id: profileData.chef_hierarchique_id,
              first_name: chefProfiles[0].first_name,
              last_name: chefProfiles[0].last_name,
              photo_url: chefPhoto?.photo_url || null,
              fonction: chefPhoto?.fonction || null,
            };
          }
        }

        setProfile({
          id: publicProfile.id,
          first_name: publicProfile.first_name,
          last_name: publicProfile.last_name,
          email: publicProfile.email,
          photo_url: profileData?.photo_url || null,
          fonction: profileData?.fonction || null,
          position_departement: profileData?.position_departement || null,
          statut_utilisateur: profileData?.statut_utilisateur || null,
          department: profileData?.department ? {
            id: (profileData.department as any).id,
            name: (profileData.department as any).name,
          } : null,
          chef_hierarchique: chefData,
        });

        // Fetch roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', id);

        if (!rolesError) {
          setRoles(rolesData?.map(r => r.role as AppRole) || []);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  const fullName = profile 
    ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Utilisateur'
    : 'Utilisateur';

  const chefName = profile?.chef_hierarchique
    ? [profile.chef_hierarchique.first_name, profile.chef_hierarchique.last_name].filter(Boolean).join(' ')
    : null;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <Skeleton className="h-24 w-24 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (!profile) {
    return (
      <AppLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              Profil non trouvé
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>

        {/* Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              <UserAvatar
                photoUrl={profile.photo_url}
                firstName={profile.first_name}
                lastName={profile.last_name}
                size="xl"
              />
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-2xl font-bold text-foreground">{fullName}</h1>
                {profile.fonction && (
                  <p className="text-lg text-muted-foreground mt-1">{profile.fonction}</p>
                )}
                <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                  {profile.statut_utilisateur && (
                    <Badge variant={profile.statut_utilisateur === 'actif' ? 'default' : 'secondary'}>
                      {profile.statut_utilisateur === 'actif' ? 'Actif' : profile.statut_utilisateur === 'absent' ? 'Absent' : profile.statut_utilisateur}
                    </Badge>
                  )}
                  {roles.map(role => (
                    <Badge key={role} variant="outline">
                      {ROLE_LABELS[role] || role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{profile.email}</p>
            </CardContent>
          </Card>

          {/* Department */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Département
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{profile.department?.name || 'Non assigné'}</p>
              {profile.position_departement && (
                <p className="text-sm text-muted-foreground mt-1">
                  Position: {profile.position_departement}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Hierarchical Manager */}
          {profile.chef_hierarchique && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Chef hiérarchique
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/utilisateurs/${profile.chef_hierarchique?.id}`)}
                >
                  <UserAvatar
                    photoUrl={profile.chef_hierarchique.photo_url}
                    firstName={profile.chef_hierarchique.first_name}
                    lastName={profile.chef_hierarchique.last_name}
                    size="sm"
                  />
                  <div>
                    <p className="font-medium">{chefName}</p>
                    {profile.chef_hierarchique.fonction && (
                      <p className="text-sm text-muted-foreground">{profile.chef_hierarchique.fonction}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Roles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Rôles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {roles.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {roles.map(role => (
                    <Badge key={role} variant="secondary">
                      {ROLE_LABELS[role] || role}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun rôle assigné</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
