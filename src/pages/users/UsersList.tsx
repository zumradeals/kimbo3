import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Search, Building2 } from 'lucide-react';

interface UserListItem {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  photo_url: string | null;
  fonction: string | null;
  statut_utilisateur: string | null;
  department_name: string | null;
}

export default function UsersList() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['public-users-list'],
    queryFn: async () => {
      // Use RPC to get all profiles - this bypasses RLS
      const { data: profiles, error } = await supabase
        .rpc('get_public_profiles', { _user_ids: [] as string[] });

      if (error) {
        // If RPC fails with empty array, fetch all profiles the user can see
        const { data: allProfiles, error: profileError } = await supabase
          .from('profiles')
          .select(`
            id,
            first_name,
            last_name,
            email,
            photo_url,
            fonction,
            statut_utilisateur,
            department:departments(name)
          `)
          .eq('status', 'active')
          .order('first_name');

        if (profileError) throw profileError;

        return (allProfiles || []).map(p => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          photo_url: p.photo_url,
          fonction: p.fonction,
          statut_utilisateur: p.statut_utilisateur,
          department_name: (p.department as any)?.name || null,
        }));
      }

      // Enrich with photo and fonction
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map((p: any) => p.id);
        const { data: enrichedData } = await supabase
          .from('profiles')
          .select('id, photo_url, fonction, statut_utilisateur')
          .in('id', userIds);

        const enrichMap = new Map((enrichedData || []).map(e => [e.id, e]));

        return profiles.map((p: any) => {
          const enriched = enrichMap.get(p.id);
          return {
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            photo_url: enriched?.photo_url || null,
            fonction: enriched?.fonction || null,
            statut_utilisateur: enriched?.statut_utilisateur || null,
            department_name: p.department_name || null,
          };
        });
      }

      return [];
    },
  });

  const filteredUsers = users.filter((user: UserListItem) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').toLowerCase();
    return (
      fullName.includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.fonction?.toLowerCase().includes(query) ||
      user.department_name?.toLowerCase().includes(query)
    );
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Annuaire des utilisateurs
            </h1>
            <p className="text-muted-foreground mt-1">
              Consultez les profils de vos collègues
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email, fonction..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {searchQuery ? 'Aucun utilisateur trouvé' : 'Aucun utilisateur disponible'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUsers.map((user: UserListItem) => {
              const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Utilisateur';
              return (
                <Link key={user.id} to={`/utilisateurs/${user.id}`}>
                  <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <UserAvatar
                          photoUrl={user.photo_url}
                          firstName={user.first_name}
                          lastName={user.last_name}
                          size="md"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{fullName}</p>
                          {user.fonction && (
                            <p className="text-sm text-muted-foreground truncate">{user.fonction}</p>
                          )}
                          {user.department_name && (
                            <div className="flex items-center gap-1 mt-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground truncate">
                                {user.department_name}
                              </span>
                            </div>
                          )}
                        </div>
                        {user.statut_utilisateur && (
                          <Badge 
                            variant={user.statut_utilisateur === 'actif' ? 'default' : 'secondary'}
                            className="shrink-0"
                          >
                            {user.statut_utilisateur === 'actif' ? 'Actif' : user.statut_utilisateur}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''} trouvé{filteredUsers.length > 1 ? 's' : ''}
        </p>
      </div>
    </AppLayout>
  );
}