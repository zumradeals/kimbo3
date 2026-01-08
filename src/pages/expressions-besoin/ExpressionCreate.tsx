import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Info, User } from 'lucide-react';
import { UserBadge } from '@/components/ui/UserBadge';
import { useQuery } from '@tanstack/react-query';

export default function ExpressionCreate() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields (STRICTEMENT LIMITÉS)
  const [nomArticle, setNomArticle] = useState('');
  const [commentaire, setCommentaire] = useState('');

  // Fetch manager info
  const { data: manager } = useQuery({
    queryKey: ['manager', profile?.chef_hierarchique_id],
    queryFn: async () => {
      if (!profile?.chef_hierarchique_id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, photo_url, fonction, department:departments(name)')
        .eq('id', profile.chef_hierarchique_id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!profile?.chef_hierarchique_id,
  });

  const canCreate = !!profile?.department_id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nomArticle.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le nom de l\'article est obligatoire.',
        variant: 'destructive',
      });
      return;
    }

    if (!profile?.department_id) {
      toast({
        title: 'Erreur',
        description: 'Vous devez être rattaché à un département.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('expressions_besoin')
        .insert({
          user_id: user?.id,
          department_id: profile.department_id,
          nom_article: nomArticle.trim(),
          commentaire: commentaire.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Expression créée',
        description: manager 
          ? `Votre expression a été soumise à ${manager.first_name} ${manager.last_name} pour validation.`
          : 'Votre expression a été enregistrée.',
      });

      navigate(`/expressions-besoin/${data.id}`);
    } catch (error: any) {
      console.error('Error creating expression:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer l\'expression.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <AppLayout>
        <AccessDenied message="Vous devez être rattaché à un département pour exprimer un besoin." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/expressions-besoin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Nouvelle expression de besoin
            </h1>
            <p className="text-muted-foreground">
              Décrivez simplement votre besoin
            </p>
          </div>
        </div>

        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Expression simple, sans engagement</p>
              <p className="text-muted-foreground">
                Indiquez uniquement le nom de l'article et un commentaire optionnel. 
                Votre chef hiérarchique validera et précisera la quantité si nécessaire.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Manager info */}
        {manager ? (
          <Card className="border-success/20 bg-success/5">
            <CardContent className="flex items-center gap-3 py-4">
              <User className="h-5 w-5 text-success" />
              <div className="text-sm">
                <p className="text-foreground">
                  <strong>Votre responsable :</strong>
                </p>
                <div className="mt-2">
                  <UserBadge
                    userId={manager.id}
                    photoUrl={manager.photo_url}
                    firstName={manager.first_name}
                    lastName={manager.last_name}
                    fonction={manager.fonction}
                    departmentName={manager.department?.name}
                    showFonction
                    showDepartment
                    linkToProfile
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-warning/20 bg-warning/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Info className="h-5 w-5 text-warning" />
              <p className="text-sm text-foreground">
                <strong>Attention :</strong> Vous n'avez pas de chef hiérarchique défini. 
                Votre expression sera visible par les administrateurs.
              </p>
            </CardContent>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Informations du besoin</CardTitle>
              <CardDescription>
                Seulement le nom et un commentaire optionnel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto-filled fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Demandeur</Label>
                  <Input
                    value={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.email || 'Inconnu'}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Département</Label>
                  <Input
                    value={profile?.department?.name || 'Non assigné'}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              {/* Nom de l'article */}
              <div className="space-y-2">
                <Label htmlFor="nom_article">Nom de l'article *</Label>
                <Input
                  id="nom_article"
                  placeholder="Ex: Cartouches d'encre, Clavier sans fil, Vis inox 6mm..."
                  value={nomArticle}
                  onChange={(e) => setNomArticle(e.target.value)}
                  maxLength={200}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {nomArticle.length}/200 caractères
                </p>
              </div>

              {/* Commentaire */}
              <div className="space-y-2">
                <Label htmlFor="commentaire">Commentaire (optionnel)</Label>
                <Textarea
                  id="commentaire"
                  placeholder="Précisions supplémentaires, contexte, urgence particulière..."
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {commentaire.length}/500 caractères
                </p>
              </div>

              {/* Notice */}
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  ⚠️ <strong>Pas de quantité ni de prix</strong> — Votre chef hiérarchique 
                  définira la quantité lors de la validation. Cette expression sera ensuite 
                  transformée en besoin interne formel.
                </p>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3">
                <Link to="/expressions-besoin">
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || !nomArticle.trim()}>
                  {isSubmitting ? 'Envoi en cours...' : 'Soumettre l\'expression'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
