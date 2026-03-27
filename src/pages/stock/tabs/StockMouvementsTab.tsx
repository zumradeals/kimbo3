import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserBadge } from '@/components/ui/UserBadge';
import { EntrepotSelector } from '@/components/stock/EntrepotSelector';
import {
  StockMovementType,
  STOCK_MOVEMENT_TYPE_LABELS,
} from '@/types/kpm';
import {
  Search, ArrowUpCircle, ArrowDownCircle, RefreshCw, Lock, Unlock, Warehouse,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const typeColors: Record<StockMovementType, string> = {
  entree: 'bg-success/10 text-success border-success/20',
  sortie: 'bg-destructive/10 text-destructive border-destructive/20',
  ajustement: 'bg-primary/10 text-primary border-primary/20',
  reservation: 'bg-warning/10 text-warning border-warning/20',
  liberation: 'bg-muted text-muted-foreground',
};

const typeIcons: Record<StockMovementType, React.ElementType> = {
  entree: ArrowUpCircle,
  sortie: ArrowDownCircle,
  ajustement: RefreshCw,
  reservation: Lock,
  liberation: Unlock,
};

export default function StockMouvementsTab() {
  const { toast } = useToast();
  const [movements, setMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [entrepotFilter, setEntrepotFilter] = useState<string | null>(null);

  useEffect(() => { fetchMovements(); }, [entrepotFilter]);

  const fetchMovements = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('stock_movements')
        .select(`
          *,
          article_stock:articles_stock(id, designation, code),
          entrepot:entrepots(id, nom, type),
          da:demandes_achat(id, reference),
          bl:bons_livraison(id, reference),
          note_frais:notes_frais(id, reference),
          projet:projets(id, name)
        `)
        .order('created_at', { ascending: false })
        .limit(500);

      if (entrepotFilter) {
        query = query.eq('entrepot_id', entrepotFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rawMvts = data || [];
      
      // Resolve user profiles with matricule
      const actorIds = rawMvts.map((m: any) => m.created_by).filter(Boolean);
      let profilesById: Record<string, any> = {};
      if (actorIds.length > 0) {
        const { data: profilesData } = await supabase.rpc('get_public_profiles', {
          _user_ids: [...new Set(actorIds)]
        });
        (profilesData || []).forEach((p: any) => {
          profilesById[p.id] = p;
        });
      }

      setMovements(rawMvts.map((m: any) => ({
        ...m,
        profile: m.created_by ? profilesById[m.created_by] || null : null,
      })));
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMovements = movements.filter((mv) => {
    const matchesSearch =
      (mv.article_stock?.designation || '').toLowerCase().includes(search.toLowerCase()) ||
      (mv.reference || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || mv.movement_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Filtres */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filtres</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par article ou référence..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                {(Object.keys(STOCK_MOVEMENT_TYPE_LABELS) as StockMovementType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {STOCK_MOVEMENT_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <EntrepotSelector
              value={entrepotFilter}
              onChange={setEntrepotFilter}
              showAll={true}
              className="w-full sm:w-52"
            />
            <Button variant="outline" size="icon" onClick={fetchMovements}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filteredMovements.length} mouvement{filteredMovements.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Aucun mouvement trouvé.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">P.U.</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Document lié</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Utilisateur (Matricule)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMovements.map((mv: any) => {
                    const TypeIcon = typeIcons[mv.movement_type as StockMovementType];
                    // Determine source
                    let source = 'Manuel';
                    if (mv.da_id) source = 'DA';
                    else if (mv.bl_id) source = 'BL';
                    else if (mv.note_frais_id) source = 'NDF';
                    else if (mv.reference?.startsWith('ADJ-') || mv.reference?.startsWith('EDIT-')) source = 'Ajustement';
                    else if (mv.reference?.startsWith('INIT-')) source = 'Initialisation';

                    return (
                      <TableRow key={mv.id}>
                        <TableCell className="whitespace-nowrap text-xs">
                          {format(new Date(mv.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </TableCell>
                        <TableCell>
                          <Badge className={typeColors[mv.movement_type as StockMovementType]}>
                            <TypeIcon className="mr-1 h-3 w-3" />
                            {STOCK_MOVEMENT_TYPE_LABELS[mv.movement_type as StockMovementType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{mv.article_stock?.designation || 'N/A'}</div>
                          {mv.article_stock?.code && (
                            <Link to={`/stock/${mv.article_stock?.id}`} className="text-xs text-primary hover:underline font-mono">
                              {mv.article_stock.code}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span className={mv.movement_type === 'sortie' ? 'text-destructive' : 'text-success'}>
                            {mv.movement_type === 'sortie' ? '-' : '+'}{mv.quantity}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {mv.prix_unitaire != null ? mv.prix_unitaire.toLocaleString('fr-FR') : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium">
                          {mv.montant_total != null ? mv.montant_total.toLocaleString('fr-FR') + ' ₣' : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{source}</Badge>
                        </TableCell>
                        <TableCell>
                          {mv.da?.reference ? (
                            <Link to={`/demandes-achat/${mv.da_id}`} className="text-primary hover:underline text-xs font-medium">
                              {mv.da.reference}
                            </Link>
                          ) : mv.bl?.reference ? (
                            <Link to={`/bons-livraison/${mv.bl_id}`} className="text-primary hover:underline text-xs font-medium">
                              {mv.bl.reference}
                            </Link>
                          ) : mv.note_frais?.reference ? (
                            <Link to={`/notes-frais/${mv.note_frais_id}`} className="text-primary hover:underline text-xs font-medium">
                              {mv.note_frais.reference}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground text-xs">{mv.reference || '-'}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {mv.entrepot ? (
                            <div className="flex items-center gap-1">
                              <Warehouse className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs">{mv.entrepot.nom}</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {mv.profile ? (
                            <UserBadge
                              userId={mv.profile.id}
                              firstName={mv.profile.first_name}
                              lastName={mv.profile.last_name}
                              matricule={mv.profile.matricule}
                              showMatricule
                              size="sm"
                              linkToProfile
                            />
                          ) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
