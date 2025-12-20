import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Truck, Package, AlertTriangle, Clock, 
  CheckCircle, ArrowRight, XCircle 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BLEnAttente {
  id: string;
  reference: string;
  status: string;
  created_at: string;
  department: { name: string } | null;
  besoin: { title: string } | null;
}

interface StockCritique {
  id: string;
  designation: string;
  quantity_available: number;
  quantity_min: number | null;
  status: string;
  location: string | null;
}

export function LogistiqueDashboard() {
  const navigate = useNavigate();
  const [blEnAttente, setBlEnAttente] = useState<BLEnAttente[]>([]);
  const [stockCritique, setStockCritique] = useState<StockCritique[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch BL en attente (prepare, en_attente_validation)
        const { data: blData } = await supabase
          .from('bons_livraison')
          .select(`
            id,
            reference,
            status,
            created_at,
            department:departments(name),
            besoin:besoins(title)
          `)
          .in('status', ['prepare', 'en_attente_validation', 'valide'])
          .order('created_at', { ascending: false })
          .limit(10);

        setBlEnAttente(blData || []);

        // Fetch stock critique (quantity <= quantity_min or epuise)
        const { data: stockData } = await supabase
          .from('articles_stock')
          .select('id, designation, quantity_available, quantity_min, status, location')
          .or('status.eq.epuise,quantity_available.lte.quantity_min')
          .order('quantity_available', { ascending: true })
          .limit(10);

        // Filter for critical stock (where quantity_available <= quantity_min)
        const criticalStock = (stockData || []).filter(
          s => s.status === 'epuise' || s.quantity_available <= (s.quantity_min || 0)
        );
        setStockCritique(criticalStock);

      } catch (error) {
        console.error('Error fetching logistique data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getBlStatusBadge = (status: string) => {
    switch (status) {
      case 'prepare':
        return <Badge variant="outline" className="bg-muted/50">Préparé</Badge>;
      case 'en_attente_validation':
        return <Badge variant="secondary" className="bg-warning/10 text-warning">En attente validation</Badge>;
      case 'valide':
        return <Badge variant="secondary" className="bg-primary/10 text-primary">Validé</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getStockStatusIcon = (item: StockCritique) => {
    if (item.status === 'epuise' || item.quantity_available <= 0) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader><div className="h-5 bg-muted rounded w-1/2" /></CardHeader>
          <CardContent><div className="h-32 bg-muted rounded" /></CardContent>
        </Card>
        <Card className="animate-pulse">
          <CardHeader><div className="h-5 bg-muted rounded w-1/2" /></CardHeader>
          <CardContent><div className="h-32 bg-muted rounded" /></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Truck className="h-5 w-5 text-primary" />
        Tableau de bord Logistique
      </h2>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* BL en attente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-warning" />
              BL en attente ({blEnAttente.length})
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/bons-livraison')}
              className="text-xs"
            >
              Voir tout <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {blEnAttente.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="mx-auto h-8 w-8 mb-2 text-success" />
                <p className="text-sm">Aucun BL en attente</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {blEnAttente.map((bl) => (
                  <div 
                    key={bl.id} 
                    className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/bons-livraison/${bl.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{bl.reference}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {bl.besoin?.title || 'N/A'} • {bl.department?.name || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {format(new Date(bl.created_at), 'dd MMM', { locale: fr })}
                      </span>
                      {getBlStatusBadge(bl.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock critique */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Stock critique ({stockCritique.length})
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/stock')}
              className="text-xs"
            >
              Voir tout <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent>
            {stockCritique.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="mx-auto h-8 w-8 mb-2 text-success" />
                <p className="text-sm">Tous les stocks sont normaux</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {stockCritique.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/5 cursor-pointer transition-colors"
                    onClick={() => navigate('/stock')}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getStockStatusIcon(item)}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.designation}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.location || 'Emplacement non défini'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${item.quantity_available <= 0 ? 'text-destructive' : 'text-warning'}`}>
                        {item.quantity_available}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Min: {item.quantity_min || 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
