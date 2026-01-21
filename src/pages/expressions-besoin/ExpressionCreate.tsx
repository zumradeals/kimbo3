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
import { ArrowLeft, Info, User, Plus, Trash2, Send, Calendar, MapPin, FolderOpen } from 'lucide-react';
import { UserBadge } from '@/components/ui/UserBadge';
import { useQuery } from '@tanstack/react-query';
import { MobileFormFooter, MobileFormSpacer } from '@/components/ui/MobileFormFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatFullName } from '@/types/expression-besoin';
import { ProjetSelector } from '@/components/ui/ProjetSelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ArticleLine {
  id: string;
  nomArticle: string;
  quantite: string;
  unite: string;
  justification: string;
}

export default function ExpressionCreate() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitDirect, setSubmitDirect] = useState(true);

  // Multi-line articles
  const [articles, setArticles] = useState<ArticleLine[]>([
    { id: crypto.randomUUID(), nomArticle: '', quantite: '', unite: 'unité', justification: '' }
  ]);
  const [commentaire, setCommentaire] = useState('');

  // Nouveaux champs: projet, lieu, date
  const [projetId, setProjetId] = useState<string | null>(null);
  const [lieuProjet, setLieuProjet] = useState('');
  const [dateSouhaitee, setDateSouhaitee] = useState('');

  // Fetch projet info for location autofill
  const { data: selectedProjet } = useQuery({
    queryKey: ['projet', projetId],
    queryFn: async () => {
      if (!projetId) return null;
      const { data, error } = await supabase
        .from('projets')
        .select('id, name, location')
        .eq('id', projetId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!projetId,
  });

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
  const hasManager = !!profile?.chef_hierarchique_id;

  const addArticle = () => {
    setArticles([...articles, { id: crypto.randomUUID(), nomArticle: '', quantite: '', unite: 'unité', justification: '' }]);
  };

  const removeArticle = (id: string) => {
    if (articles.length > 1) {
      setArticles(articles.filter(a => a.id !== id));
    }
  };

  const updateArticle = (id: string, field: keyof ArticleLine, value: string) => {
    setArticles(articles.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const validArticles = articles.filter(a => a.nomArticle.trim());

  // Autofill lieu from projet
  const handleProjetChange = (value: string | null) => {
    setProjetId(value);
    // Will autofill location when selectedProjet loads
  };

  // Autofill location when projet changes
  if (selectedProjet?.location && !lieuProjet) {
    setLieuProjet(selectedProjet.location);
  }

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
      // 1. Créer l'expression groupe (parent)
      const titre = validArticles.length > 1 
        ? `${validArticles.length} articles demandés`
        : validArticles[0].nomArticle.trim();

      const { data: expression, error: expressionError } = await supabase
        .from('expressions_besoin')
        .insert({
          user_id: user?.id,
          department_id: profile.department_id,
          titre,
          nom_article: titre, // Legacy field - pour compatibilité
          commentaire: commentaire.trim() || null,
          projet_id: projetId || null,
          lieu_projet: lieuProjet.trim() || null,
          date_souhaitee: dateSouhaitee || null,
          status: submitDirect ? 'soumis' : 'brouillon',
          submitted_at: submitDirect ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (expressionError) throw expressionError;

      // 2. Créer les lignes d'articles
      const lignes = validArticles.map(article => ({
        expression_id: expression.id,
        nom_article: article.nomArticle.trim(),
        quantite: article.quantite ? parseInt(article.quantite) : null,
        unite: article.unite || 'unité',
        justification: article.justification.trim() || null,
      }));

      const { error: lignesError } = await supabase
        .from('expressions_besoin_lignes')
        .insert(lignes);

      if (lignesError) throw lignesError;

      const count = validArticles.length;
      
      if (submitDirect && manager) {
        toast({
          title: 'Expression soumise',
          description: `${count} article${count > 1 ? 's' : ''} soumis à ${formatFullName(manager.first_name, manager.last_name)} pour validation.`,
        });
      } else if (submitDirect) {
        toast({
          title: 'Expression soumise',
          description: `${count} article${count > 1 ? 's' : ''} en attente de validation.`,
        });
      } else {
        toast({
          title: 'Expression créée',
          description: `${count} article${count > 1 ? 's' : ''} enregistré${count > 1 ? 's' : ''} en brouillon.`,
        });
      }

      // Naviguer vers le détail de l'expression
      navigate(`/expressions-besoin/${expression.id}`);
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
              <p className="font-medium text-foreground">Expression groupée</p>
              <p className="text-muted-foreground">
                Tous vos articles seront soumis ensemble dans une seule expression. 
                Votre chef hiérarchique les validera d'un seul coup.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Manager info */}
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
                Ajoutez un ou plusieurs articles — ils seront traités ensemble
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

              {/* Projet, Lieu et Date souhaitée */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4" />
                    Projet (optionnel)
                  </Label>
                  <ProjetSelector
                    value={projetId}
                    onChange={handleProjetChange}
                    placeholder="Sélectionner un projet"
                    allowEmpty
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lieu" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Lieu (optionnel)
                  </Label>
                  <Input
                    id="lieu"
                    placeholder="Ex: Siège, Chantier Nord..."
                    value={lieuProjet}
                    onChange={(e) => setLieuProjet(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date souhaitée (optionnel)
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={dateSouhaitee}
                    onChange={(e) => setDateSouhaitee(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              {/* Articles list */}
              <div className="space-y-4">
                <Label>Articles demandés *</Label>
                {articles.map((article, index) => (
                  <Card key={article.id} className="p-4 bg-muted/30">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground">Nom de l'article *</Label>
                          <Input
                            placeholder={`Article ${index + 1} (ex: Cartouches d'encre)`}
                            value={article.nomArticle}
                            onChange={(e) => updateArticle(article.id, 'nomArticle', e.target.value)}
                            maxLength={200}
                          />
                        </div>
                        {articles.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeArticle(article.id)}
                            className="shrink-0 text-destructive hover:text-destructive mt-5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Quantité</Label>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Ex: 10"
                            value={article.quantite}
                            onChange={(e) => updateArticle(article.id, 'quantite', e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Unité</Label>
                          <Select 
                            value={article.unite} 
                            onValueChange={(v) => updateArticle(article.id, 'unite', v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unité">Unité</SelectItem>
                              <SelectItem value="pièce">Pièce</SelectItem>
                              <SelectItem value="kg">Kilogramme</SelectItem>
                              <SelectItem value="litre">Litre</SelectItem>
                              <SelectItem value="mètre">Mètre</SelectItem>
                              <SelectItem value="boîte">Boîte</SelectItem>
                              <SelectItem value="lot">Lot</SelectItem>
                              <SelectItem value="carton">Carton</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 sm:col-span-1">
                          <Label className="text-xs text-muted-foreground">Justification (optionnel)</Label>
                          <Input
                            placeholder="Pourquoi ce besoin?"
                            value={article.justification}
                            onChange={(e) => updateArticle(article.id, 'justification', e.target.value)}
                            maxLength={300}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
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
