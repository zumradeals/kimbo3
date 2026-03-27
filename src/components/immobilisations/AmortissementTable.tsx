import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calculator, TrendingDown } from 'lucide-react';
import {
  calculerAmortissement,
  getInfosDegressif,
  type AmortissementParams,
  type AmortissementLigne,
} from '@/utils/amortissement';

interface Props {
  valeurAcquisition: number;
  dureeVieAnnees: number;
  dateAcquisition: string;
  dateDebutExercice?: string;
  moisAcquisition?: string;
  mode: 'lineaire' | 'degressif' | 'non_amortissable';
  devise?: string;
}

const MODE_LABELS: Record<string, string> = {
  lineaire: 'Linéaire',
  degressif: 'Dégressif',
  non_amortissable: 'Non amortissable',
};

export function AmortissementTable({
  valeurAcquisition, dureeVieAnnees, dateAcquisition,
  dateDebutExercice, moisAcquisition, mode, devise = 'FCFA',
}: Props) {
  if (mode === 'non_amortissable') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />Amortissement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Badge variant="outline">Non amortissable</Badge>
            <span className="text-sm">Ce bien n'est pas soumis à l'amortissement (ex: terrain)</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!valeurAcquisition || !dureeVieAnnees) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />Amortissement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Renseignez la valeur d'acquisition et la durée de vie pour voir le tableau d'amortissement.
          </p>
        </CardContent>
      </Card>
    );
  }

  const params: AmortissementParams = {
    valeurAcquisition,
    dureeVieAnnees,
    dateAcquisition,
    dateDebutExercice,
    moisAcquisition,
    mode,
  };

  const lignes = calculerAmortissement(params);
  const isDegressif = mode === 'degressif';
  const infosDegressif = isDegressif ? getInfosDegressif(dureeVieAnnees) : null;

  const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Tableau d'amortissement {MODE_LABELS[mode]}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{MODE_LABELS[mode]}</Badge>
            <Badge variant="secondary">{dureeVieAnnees} ans</Badge>
            {infosDegressif && (
              <>
                <Badge variant="secondary">Coeff: {infosDegressif.coefficient}</Badge>
                <Badge variant="secondary">Taux: {infosDegressif.tauxDegressif}%</Badge>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">Année</TableHead>
              <TableHead className="text-right">VNC début exercice</TableHead>
              <TableHead className="text-right">Annuité d'amortissement</TableHead>
              <TableHead className="text-right">Amortissements cumulés</TableHead>
              <TableHead className="text-right">VNC fin exercice</TableHead>
              {isDegressif && (
                <>
                  <TableHead className="text-center">Taux linéaire</TableHead>
                  <TableHead className="text-center">Années restantes</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((l: AmortissementLigne) => (
              <TableRow key={l.annee}>
                <TableCell className="text-center font-medium">{l.annee}</TableCell>
                <TableCell className="text-right font-mono">{fmt(l.vncDebut)} {devise}</TableCell>
                <TableCell className="text-right font-mono font-medium text-destructive">{fmt(l.annuite)} {devise}</TableCell>
                <TableCell className="text-right font-mono">{fmt(l.cumulAmortissements)} {devise}</TableCell>
                <TableCell className="text-right font-mono font-medium">{fmt(l.vncFin)} {devise}</TableCell>
                {isDegressif && (
                  <>
                    <TableCell className="text-center">{l.tauxLineaire?.toFixed(2)}%</TableCell>
                    <TableCell className="text-center">{l.anneesRestantes}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
            {lignes.length > 0 && (
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="text-center">TOTAL</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono">
                  {fmt(lignes.reduce((s, l) => s + l.annuite, 0))} {devise}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(lignes[lignes.length - 1].cumulAmortissements)} {devise}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(lignes[lignes.length - 1].vncFin)} {devise}
                </TableCell>
                {isDegressif && <><TableCell /><TableCell /></>}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
