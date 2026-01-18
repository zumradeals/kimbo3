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
import { ArrowLeft, Info, User, Plus, Trash2, Send, AlertCircle } from 'lucide-react';
import { UserBadge } from '@/components/ui/UserBadge';
import { useQuery } from '@tanstack/react-query';
import { MobileFormFooter, MobileFormSpacer } from '@/components/ui/MobileFormFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatFullName } from '@/types/expression-besoin';

interface ArticleLine {
  id: string;
  nomArticle: string;
}

export default function ExpressionCreate() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitDirect, setSubmitDirect] = useState(true); // Par défaut, soumettre directement

  // Multi-line articles
  const [articles, setArticles] = useState<ArticleLine[]>([
    { id: crypto.randomUUID(), nomArticle: '' }
  ]);
  const [commentaire, setCommentaire] = useState('');

  // Fetch manager info
  const { data: manager, isLoading: isLoadingManager } = useQuery({
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
  const hasManager = !!profile?.chef_hierarchique_id;

  const addArticle = () => {
    setArticles([...articles, { id: crypto.randomUUID(), nomArticle: '' }]);
  };

  const removeArticle = (id: string) => {
    if (articles.length > 1) {
      setArticles(articles.filter(a => a.id !== id));
    }
  };

  const updateArticle = (id: string, value: string) => {
    setArticles(articles.map(a => a.id === id ? { ...a, nomArticle: value } : a));
  };

  const validArticles = articles.filter(a => a.nomArticle.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validArticles.length === 0) {
      toast({
        title: 'Erreur',
        description: 'Ajoutez au moins un article.',
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
      // Insert all articles as separate expressions
      // Si submitDirect est true, on utilise le statut 'soumis', sinon 'brouillon'
      const expressionsToCreate = validArticles.map(article => ({
        user_id: user?.id,
        department_id: profile.department_id,
        nom_article: article.nomArticle.trim(),
        commentaire: commentaire.trim() || null,
        status: (submitDirect ? 'soumis' : 'brouillon') as 'soumis' | 'brouillon',
        submitted_at: submitDirect ? new Date().toISOString() : null,
      }));

      const { data, error } = await supabase
        .from('expressions_besoin')
        .insert(expressionsToCreate)
        .select();

      if (error) throw error;

      const count = data?.length || validArticles.length;
      
      if (submitDirect && manager) {
        toast({
          title: `${count} expression${count > 1 ? 's' : ''} soumise${count > 1 ? 's' : ''}`,
          description: `Soumise${count > 1 ? 's' : ''} à ${formatFullName(manager.first_name, manager.last_name)} pour validation.`,
        });
      } else if (submitDirect) {
        toast({
          title: `${count} expression${count > 1 ? 's' : ''} soumise${count > 1 ? 's' : ''}`,
          description: 'En attente de validation.',
        });
      } else {
        toast({
          title: `${count} expression${count > 1 ? 's' : ''} créée${count > 1 ? 's' : ''}`,
          description: 'Enregistrée(s) en brouillon.',
        });
      }

      // Navigate to list or first expression
      if (data && data.length === 1) {
        navigate(`/expressions-besoin/${data[0].id}`);
      } else {
        navigate('/expressions-besoin');
      }
    } catch (error: any) {
      console.error('Error creating expressions:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer les expressions.',
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

  const formActions = (
    <>
      <Link to="/expressions-besoin" className="flex-1 sm:flex-none">
        <Button type="button" variant="outline" disabled={isSubmitting} className="w-full">
          Annuler
        </Button>
      </Link>
      <Button 
        type="submit" 
        disabled={isSubmitting || validArticles.length === 0}
        className="flex-1 sm:flex-none"
      >
        {isSubmitting ? (
          'Envoi...'
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {validArticles.length > 1 
              ? `Soumettre ${validArticles.length} articles` 
              : 'Soumettre'
            }
          </>
        )}
      </Button>
    </>
  );

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
            <h1 className="font-serif text-xl sm:text-2xl font-bold text-foreground">
              Nouvelle expression de besoin
            </h1>
            <p className="text-sm text-muted-foreground">
              Listez les articles dont vous avez besoin
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
                Indiquez les noms des articles souhaités. 
                Votre chef hiérarchique validera et précisera les quantités avant transmission à la logistique.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Manager info (informational only) */}
        {hasManager && manager && (
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
        )}

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Articles demandés</CardTitle>
              <CardDescription>
                Ajoutez un ou plusieurs articles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Auto-filled fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Demandeur</Label>
                  <Input
                    value={formatFullName(profile?.first_name, profile?.last_name)}
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

              {/* Articles list */}
              <div className="space-y-3">
                <Label>Nom des articles *</Label>
                {articles.map((article, index) => (
                  <div key={article.id} className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder={`Article ${index + 1} (ex: Cartouches d'encre, Clavier...)`}
                        value={article.nomArticle}
                        onChange={(e) => updateArticle(article.id, e.target.value)}
                        maxLength={200}
                      />
                    </div>
                    {articles.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeArticle(article.id)}
                        className="shrink-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addArticle}
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Ajouter un article
                </Button>
              </div>

              {/* Commentaire global */}
              <div className="space-y-2">
                <Label htmlFor="commentaire">Commentaire global (optionnel)</Label>
                <Textarea
                  id="commentaire"
                  placeholder="Contexte, urgence particulière, précisions..."
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  maxLength={500}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  {commentaire.length}/500 caractères • S'applique à tous les articles
                </p>
              </div>

              {/* Notice */}
              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">
                  ⚠️ <strong>Pas de quantité ni de prix</strong> — Votre chef hiérarchique 
                  définira les quantités lors de la validation. Chaque article créera une expression séparée.
                </p>
              </div>

              {/* Desktop Submit */}
              {!isMobile && (
                <div className="flex justify-end gap-3">
                  {formActions}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mobile sticky footer */}
          {isMobile && (
            <>
              <MobileFormSpacer />
              <MobileFormFooter>
                {formActions}
              </MobileFormFooter>
            </>
          )}
        </form>
      </div>
    </AppLayout>
  );
}
