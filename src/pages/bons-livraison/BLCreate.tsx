import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Besoin, OPERATIONAL_ROLES } from '@/types/kpm';
import { ArrowLeft, Plus, Trash2, AlertTriangle, Package, Link as LinkIcon, Unlink, Warehouse } from 'lucide-react';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { StockArticleSelector } from '@/components/bons-livraison/StockArticleSelector';
import { StockSelector } from '@/components/stock/EntrepotSelector';
import { Stock } from '@/types/entrepot';

interface ArticleForm {
  designation: string;
  quantity: string;
  unit: string;
  observations: string;
  article_stock_id?: string | null;
  stock_available?: number;
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
    entrepot_id: null as string | null,
  });

  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [articles, setArticles] = useState<ArticleForm[]>([]);
  const [lignesLoaded, setLignesLoaded] = useState(false);

  // Mutualisation: Logistique ET Achats peuvent créer des BL
  const isOperational = roles.some((r) => OPERATIONAL_ROLES.includes(r));
  const hasAccess = isOperational || isAdmin;

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

      const { data: lignesData } = await supabase
        .from('besoin_lignes')
        .select('*')
        .eq('besoin_id', besoinId)
        .order('created_at', { ascending: true });

      setBesoin(data as Besoin);

      if (data.lieu_livraison) {
        setForm((prev) => ({
          ...prev,
          warehouse: data.lieu_livraison || '',
        }));
      }

      if (lignesData && lignesData.length > 0 && !lignesLoaded) {
        // Fetch stock availability for linked articles
        const stockIds = lignesData
          .filter((l) => l.article_stock_id)
          .map((l) => l.article_stock_id as string);

        let stockMap: Record<string, { quantity_available: number; quantity_reserved: number }> = {};
        if (stockIds.length > 0) {
          const { data: stockData } = await supabase
            .from('articles_stock')
            .select('id, quantity_available, quantity_reserved')
            .in('id', stockIds);
          
          if (stockData) {
            stockMap = stockData.reduce((acc, s) => {
              acc[s.id] = { quantity_available: s.quantity_available, quantity_reserved: s.quantity_reserved };
              return acc;
            }, {} as Record<string, { quantity_available: number; quantity_reserved: number }>);
          }
        }

        const articlesFromLignes: ArticleForm[] = lignesData.map((ligne) => {
          const stockInfo = ligne.article_stock_id ? stockMap[ligne.article_stock_id] : null;
          const available = stockInfo 
            ? Math.max(0, stockInfo.quantity_available - stockInfo.quantity_reserved) 
            : undefined;
          
          return {
            designation: ligne.designation,
            quantity: String(ligne.quantity),
            unit: ligne.unit,
            observations: ligne.justification || '',
            article_stock_id: ligne.article_stock_id || null,
            stock_available: available,
          };
        });
        setArticles(articlesFromLignes);
        setLignesLoaded(true);
      } else if (!lignesLoaded) {
        setArticles([{ designation: '', quantity: '1', unit: 'unité', observations: '', article_stock_id: null }]);
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
    setArticles((prev) => [...prev, { designation: '', quantity: '1', unit: 'unité', observations: '', article_stock_id: null }]);
  };

  const addArticleFromStock = (stockArticle: {
    id: string;
    designation: string;
    unit: string;
    quantity_available: number;
    quantity_reserved: number;
  }) => {
    const available = Math.max(0, stockArticle.quantity_available - stockArticle.quantity_reserved);
    setArticles((prev) => [
      ...prev,
      {
        designation: stockArticle.designation,
        quantity: '1',
        unit: stockArticle.unit,
        observations: '',
        article_stock_id: stockArticle.id,
        stock_available: available,
      },
    ]);
    toast({
      title: 'Article ajouté',
      description: `${stockArticle.designation} (${available} ${stockArticle.unit} disponibles)`,
    });
  };

  const linkToStock = (index: number, stockArticle: {
    id: string;
    designation: string;
    unit: string;
    quantity_available: number;
    quantity_reserved: number;
  }) => {
    const available = Math.max(0, stockArticle.quantity_available - stockArticle.quantity_reserved);
    const updated = [...articles];
    updated[index] = {
      ...updated[index],
      article_stock_id: stockArticle.id,
      stock_available: available,
      unit: stockArticle.unit,
    };
    setArticles(updated);
    toast({
      title: 'Article lié au stock',
      description: `${available} ${stockArticle.unit} disponibles`,
    });
  };

  const unlinkFromStock = (index: number) => {
    const updated = [...articles];
    updated[index] = {
      ...updated[index],
      article_stock_id: null,
      stock_available: undefined,
    };
    setArticles(updated);
  };

  const removeArticle = (index: number) => {
    if (articles.length > 1) {
      setArticles(articles.filter((_, i) => i !== index));
    }
  };

  const updateArticle = (index: number, field: keyof ArticleForm, value: string) => {
    const updated = [...articles];
    updated[index] = { ...updated[index], [field]: value };
    setArticles(updated);
  };

  const validateStock = (): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    articles.forEach((article, index) => {
      if (article.article_stock_id && article.stock_available !== undefined) {
        const qty = parseFloat(article.quantity);
        if (qty > article.stock_available) {
          errors.push(
            `Article ${index + 1} (${article.designation}): quantité demandée (${qty}) > disponible (${article.stock_available})`
          );
        }
      }
    });
    return { valid: errors.length === 0, errors };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!besoin || !user) return;

    const validArticles = articles.filter((a) => a.designation.trim() && parseFloat(a.quantity) > 0);
    if (validArticles.length === 0) {
      toast({ title: 'Erreur', description: 'Au moins un article est requis.', variant: 'destructive' });
      return;
    }

    // Validate stock quantities
    const stockValidation = validateStock();
    if (!stockValidation.valid) {
      toast({
        title: 'Stock insuffisant',
        description: stockValidation.errors.join('\n'),
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      const { data: refData, error: refError } = await supabase.rpc('generate_bl_reference');
      if (refError) throw refError;

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
          bl_type: 'interne',
          entrepot_id: form.entrepot_id,
        })
        .select()
        .single();

      if (blError) throw blError;

      const articlesToInsert = validArticles.map((a) => ({
        bl_id: bl.id,
        designation: a.designation.trim(),
        quantity: parseFloat(a.quantity),
        unit: a.unit,
        observations: a.observations.trim() || null,
        article_stock_id: a.article_stock_id || null,
        quantity_ordered: parseFloat(a.quantity),
      }));

      const { error: artError } = await supabase.from('bl_articles').insert(articlesToInsert);
      if (artError) throw artError;

      toast({ title: 'BL créé', description: `Le bon ${refData} a été créé avec succès.` });
      navigate(`/bons-livraison/${bl.id}`);
    } catch (error: any) {
      const message =
        error?.message ||
        error?.error_description ||
        error?.details ||
        (typeof error === 'string' ? error : null) ||
        'Erreur inconnue lors de la création du bon de livraison.';

      console.error('BLCreate submit error:', { error, message });
      toast({ title: 'Erreur', description: message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const linkedStockIds = articles
    .filter((a) => a.article_stock_id)
    .map((a) => a.article_stock_id as string);

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
              <p className="font-medium text-foreground">Livraison depuis le stock</p>
              <p className="text-sm text-muted-foreground">
                Liez chaque article au stock pour vérifier la disponibilité. Le stock sera décrémenté à la livraison.
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
            {/* Stock source */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Warehouse className="h-4 w-4" />
                Stock source <span className="text-destructive">*</span>
              </Label>
              <StockSelector
                value={form.entrepot_id}
                onChange={(val) => setForm({ ...form, entrepot_id: val })}
                onStockChange={setSelectedStock}
                showAll={false}
                placeholder="Sélectionner le stock source..."
              />
              {selectedStock && (
                <p className="text-xs text-muted-foreground">
                  {selectedStock.localisation && `📍 ${selectedStock.localisation}`}
                </p>
              )}
            </div>

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
                <Label>Lieu de livraison</Label>
                <Input
                  placeholder="Ex: Chantier Riviera"
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
                  Liez les articles au stock pour vérifier les quantités disponibles
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <StockArticleSelector
                  onSelect={addArticleFromStock}
                  excludeIds={linkedStockIds}
                />
                <Button type="button" variant="outline" size="sm" onClick={addArticle}>
                  <Plus className="mr-2 h-4 w-4" />
                  Manuel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {articles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <Package className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground">Ajoutez des articles depuis le stock ou manuellement</p>
              </div>
            ) : (
              articles.map((article, index) => {
                const qty = parseFloat(article.quantity) || 0;
                const isOverStock = article.stock_available !== undefined && qty > article.stock_available;
                const isLinked = !!article.article_stock_id;

                return (
                  <div
                    key={index}
                    className={`rounded-lg border p-4 ${
                      isOverStock ? 'border-destructive/50 bg-destructive/5' : 'bg-muted/30'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          Article {index + 1}
                        </span>
                        {isLinked ? (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                            <LinkIcon className="mr-1 h-3 w-3" />
                            Lié au stock
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Manuel
                          </Badge>
                        )}
                        {article.stock_available !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            ({article.stock_available} {article.unit} disponibles)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isLinked ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 text-muted-foreground hover:text-foreground"
                            onClick={() => unlinkFromStock(index)}
                            title="Délier du stock"
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        ) : (
                          <StockArticleSelector
                            onSelect={(stockArticle) => linkToStock(index, stockArticle)}
                            excludeIds={linkedStockIds}
                          />
                        )}
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
                    </div>

                    {isOverStock && (
                      <div className="mb-3 flex items-center gap-2 text-sm text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        Stock insuffisant: {article.stock_available} {article.unit} disponibles
                      </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="sm:col-span-2">
                        <Label>Désignation *</Label>
                        <Input
                          placeholder="Nom de l'article"
                          value={article.designation}
                          onChange={(e) => updateArticle(index, 'designation', e.target.value)}
                          disabled={isLinked}
                        />
                      </div>
                      <div>
                        <Label>Quantité *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={article.stock_available}
                          value={article.quantity}
                          onChange={(e) => updateArticle(index, 'quantity', e.target.value)}
                          className={isOverStock ? 'border-destructive' : ''}
                        />
                      </div>
                      <div>
                        <Label>Unité</Label>
                        <Input
                          placeholder="unité"
                          value={article.unit}
                          onChange={(e) => updateArticle(index, 'unit', e.target.value)}
                          disabled={isLinked}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
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
