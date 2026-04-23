import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Package, Maximize2, Minimize2 } from 'lucide-react';
import {
  BESOIN_LIGNE_CATEGORY_LABELS,
  BESOIN_URGENCY_LABELS,
  BesoinUrgency,
} from '@/types/kpm';
import { PaginationControls } from '@/components/ui/PaginationControls';

interface BesoinLigneRow {
  id: string;
  designation: string;
  category: keyof typeof BESOIN_LIGNE_CATEGORY_LABELS;
  unit: string;
  quantity: number;
  urgency: BesoinUrgency;
  justification?: string;
  article_stock_id?: string | null;
}

interface Props {
  lignes: BesoinLigneRow[];
}

const urgencyColors: Record<BesoinUrgency, string> = {
  normale: 'bg-muted text-muted-foreground',
  urgente: 'bg-warning/10 text-warning',
  critique: 'bg-destructive/10 text-destructive',
};

/**
 * Affichage compact + paginé des lignes de besoin pour la vue détail.
 * - Numérotation séquentielle stable (1, 2, 3, ...) basée sur l'index courant.
 * - Bouton "Tout afficher / Réduire" pour basculer entre mode paginé et mode complet.
 */
export function BesoinLignesCompact({ lignes }: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [showAll, setShowAll] = useState(false);

  const totalPages = Math.max(1, Math.ceil(lignes.length / pageSize));
  const visible = useMemo(() => {
    if (showAll) return lignes;
    const start = (page - 1) * pageSize;
    return lignes.slice(start, start + pageSize);
  }, [lignes, page, pageSize, showAll]);

  // Numéro absolu = position dans la liste complète (toujours 1..N)
  const startIndex = showAll ? 0 : (page - 1) * pageSize;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {lignes.length} ligne{lignes.length > 1 ? 's' : ''} au total
        </p>
        {lignes.length > pageSize && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAll((v) => !v)}
            className="h-7"
          >
            {showAll ? (
              <>
                <Minimize2 className="mr-1 h-3 w-3" />
                Réduire
              </>
            ) : (
              <>
                <Maximize2 className="mr-1 h-3 w-3" />
                Tout afficher
              </>
            )}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center py-2">N°</TableHead>
              <TableHead className="py-2">Désignation</TableHead>
              <TableHead className="w-[110px] py-2">Catégorie</TableHead>
              <TableHead className="w-[70px] text-center py-2">Qté</TableHead>
              <TableHead className="w-[80px] py-2">Unité</TableHead>
              <TableHead className="w-[100px] py-2">Urgence</TableHead>
              <TableHead className="py-2">Justification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((ligne, idx) => {
              const num = startIndex + idx + 1;
              return (
                <TableRow key={ligne.id} className="text-sm">
                  <TableCell className="text-center font-medium text-muted-foreground py-2">
                    {num}
                  </TableCell>
                  <TableCell className="font-medium py-2">
                    <div className="flex items-center gap-2">
                      {ligne.article_stock_id && (
                        <span title="Article du stock">
                          <Package className="h-3.5 w-3.5 text-primary" />
                        </span>
                      )}
                      <span className="truncate" title={ligne.designation}>
                        {ligne.designation}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2">
                    <Badge variant="outline" className="text-xs">
                      {BESOIN_LIGNE_CATEGORY_LABELS[ligne.category]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center py-2">{ligne.quantity}</TableCell>
                  <TableCell className="py-2">{ligne.unit}</TableCell>
                  <TableCell className="py-2">
                    <Badge className={`${urgencyColors[ligne.urgency]} text-xs`}>
                      {ligne.urgency === 'critique' && (
                        <AlertTriangle className="mr-1 h-3 w-3" />
                      )}
                      {BESOIN_URGENCY_LABELS[ligne.urgency].split(' ')[0]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-2 max-w-[200px] truncate" title={ligne.justification || ''}>
                    {ligne.justification || '-'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!showAll && lignes.length > pageSize && (
        <PaginationControls
          page={page}
          totalPages={totalPages}
          totalCount={lignes.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
          pageSizeOptions={[5, 10, 25, 50]}
        />
      )}
    </div>
  );
}