import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Besoin, LOGISTICS_ROLES } from '@/types/kpm';
import { ArrowLeft, Plus, Trash2, Info, AlertTriangle, Package } from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';

interface ArticleForm {
  designation: string;
  quantity: string;
  unit: string;
  observations: string;
}

export default function BLCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const besoinId = searchParams.get('besoin');

  const { user, roles, isAdmin } = useAuth();
  const { toast } = useToast();

  const [besoin, setBesoin] = useState<Besoin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [canTransform, setCanTransform] = useState(false);

  const [form, setForm] = useState({
    delivery_date: '',
    warehouse: '',
    observations: '',
  });

  const [articles, setArticles] = useState<ArticleForm[]>([]);
  const [lignesLoaded, setLignesLoaded] = useState(false);

  const isLogistics = roles.some((r) => LOGISTICS_ROLES.includes(r));
  const hasAccess = isLogistics || isAdmin;

  useEffect(() => {
    if (besoinId) {
      fetchBesoinWithLignes();
      checkCanTransform();
    } else {
      setIsLoading(false);
    }
  }, [besoinId]);

  const fetchBesoinWithLignes = async () => {
    try {
      // Fetch besoin
      const { data, error } = await supabase
        .from('besoins')
        .select(`
          *,
          department:departments(id, name),
          user:profiles!besoins_user_id_fkey(id, first_name, last_name, email)
        `)
        .eq('id', besoinId)
        .maybeSingle();

      if (error || !data) {
        toast({ title: 'Erreur', description: 'Besoin introuvable.', variant: 'destructive' });
        navigate('/besoins');
        return;
      }

      // Fetch lignes du besoin
      const { data: lignesData } = await supabase
        .from('besoin_lignes')
        .select('*')
        .eq('besoin_id', besoinId)
        .order('created_at', { ascending: true });

      setBesoin(data as Besoin);

      // Pre-fill delivery location from besoin if available
      if (data.lieu_livraison) {
        setForm((prev) => ({
          ...prev,
          warehouse: data.lieu_livraison || '',
        }));
      }

      // Auto-populate articles from besoin lignes
      if (lignesData && lignesData.length > 0 && !lignesLoaded) {
        const articlesFromLignes: ArticleForm[] = lignesData.map((ligne) => ({
          designation: ligne.designation,
          quantity: String(ligne.quantity),
          unit: ligne.unit,
          observations: ligne.justification || '',
        }));
        setArticles(articlesFromLignes);
        setLignesLoaded(true);
      } else if (!lignesLoaded) {
        // Fallback: create one empty article if no lignes
        setArticles([{ designation: '', quantity: '1', unit: 'unité', observations: '' }]);
        setLignesLoaded(true);
      }
    } catch (error: any) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkCanTransform = async () => {
    const { data } = await supabase.rpc('can_transform_besoin', { _besoin_id: besoinId });
    setCanTransform(data === true);
  };

  const addArticle = () => {
    setArticles((prev) => [...prev, { designation: '', quantity: '1', unit: 'unité', observations: '' }]);
  };

  const removeArticle = (index: number) => {
    if (articles.length > 1) {
      setArticles(articles.filter((_, i) => i !== index));
    }
  };

  const updateArticle = (index: number, field: keyof ArticleForm, value: string) => {
    const updated = [...articles];
    updated[index][field] = value;
    setArticles(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!besoin || !user) return;

    const validArticles = articles.filter((a) => a.designation.trim() && parseFloat(a.quantity) > 0);
    if (validArticles.length === 0) {
      toast({ title: 'Erreur', description: 'Au moins un article est requis.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);

    try {
      // Generate reference
      const { data: refData, error: refError } = await supabase.rpc('generate_bl_reference');
      if (refError) throw refError;

      // Create BL
      const { data: bl, error: blError } = await supabase
        .from('bons_livraison')
        .insert({
          reference: refData,
          besoin_id: besoin.id,
          department_id: besoin.department_id,
          created_by: user.id,
          delivery_date: form.delivery_date || null,
          warehouse: form.warehouse.trim() || null,
          observations: form.observations.trim() || null,
        })
        .select()
        .single();

      if (blError) throw blError;

      // Create articles
      const articlesToInsert = validArticles.map((a) => ({
        bl_id: bl.id,
        designation: a.designation.trim(),
        quantity: parseFloat(a.quantity),
        unit: a.unit,
        observations: a.observations.trim() || null,
      }));

      const { error: artError } = await supabase.from('bl_articles').insert(articlesToInsert);
      if (artError) throw artError;

      toast({ title: 'BL créé', description: `Le bon ${refData} a été créé avec succès.` });
      navigate(`/bons-livraison/${bl.id}`);
    } catch (error: any) {
      console.error('Error:', error);
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!hasAccess) {
    return (
      <AppLayout>
        <AccessDenied message="Seule la Direction Logistique peut créer des Bons de Livraison." />
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!besoin) {
    return (
      <AppLayout>
        <Card className="mx-auto max-w-md">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-warning" />
            <h2 className="mb-2 text-lg font-semibold">Besoin source requis</h2>
            <p className="mb-4 text-muted-foreground">
              Un BL doit être créé à partir d'un Besoin accepté.
            </p>
            <Link to="/besoins">
              <Button>Voir les besoins</Button>
            </Link>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  if (!canTransform) {
    return (
      <AppLayout>
        <Card className="mx-auto max-w-md">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-destructive" />
            <h2 className="mb-2 text-lg font-semibold">Transformation impossible</h2>
            <p className="mb-4 text-muted-foreground">
              Ce besoin ne peut pas être transformé. Il est soit déjà transformé, soit non accepté.
            </p>
            <Link to={`/besoins/${besoin.id}`}>
              <Button variant="outline">Retour au besoin</Button>
            </Link>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to={`/besoins/${besoin.id}`}>
            <Button type="button" variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Créer un Bon de Livraison
            </h1>
            <p className="text-muted-foreground">
              À partir du besoin: {besoin.title}
            </p>
          </div>
        </div>

        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium text-foreground">Conversion automatique des lignes</p>
              <p className="text-sm text-muted-foreground">
                Les lignes du besoin ont été automatiquement reprises. Ce BL permet de satisfaire le besoin 
                depuis le stock existant. Le stock sera décrémenté à la livraison effective.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Source info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Besoin source</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Titre</p>
              <p className="font-medium">{besoin.title}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Département</p>
              <p className="font-medium">{besoin.department?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Demandeur</p>
              <p className="font-medium">
                {besoin.user?.first_name} {besoin.user?.last_name}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* BL Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Informations de livraison</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date de livraison prévue</Label>
                <Input
                  type="date"
                  value={form.delivery_date}
                  onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Magasin / Dépôt</Label>
                <Input
                  placeholder="Ex: Magasin central"
                  value={form.warehouse}
                  onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observations</Label>
              <Textarea
                placeholder="Notes sur la livraison..."
                value={form.observations}
                onChange={(e) => setForm({ ...form, observations: e.target.value })}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Articles */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Articles à livrer</CardTitle>
                <CardDescription>
                  Listez les articles disponibles en stock
                </CardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addArticle}>
                <Plus className="mr-2 h-4 w-4" />
                Ajouter
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {articles.map((article, index) => (
              <div key={index} className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Article {index + 1}
                  </span>
                  {articles.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => removeArticle(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <Label>Désignation *</Label>
                    <Input
                      placeholder="Nom de l'article"
                      value={article.designation}
                      onChange={(e) => updateArticle(index, 'designation', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Quantité *</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={article.quantity}
                      onChange={(e) => updateArticle(index, 'quantity', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Unité</Label>
                    <Input
                      placeholder="unité"
                      value={article.unit}
                      onChange={(e) => updateArticle(index, 'unit', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Link to={`/besoins/${besoin.id}`}>
            <Button type="button" variant="outline">
              Annuler
            </Button>
          </Link>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Création...' : 'Créer le Bon de Livraison'}
          </Button>
        </div>
      </form>
    </AppLayout>
  );
}
