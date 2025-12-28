import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertTriangle, Package, Link2 } from 'lucide-react';
import {
  BesoinLigne,
  BesoinLigneCategory,
  BesoinUrgency,
  BESOIN_LIGNE_CATEGORY_LABELS,
  BESOIN_URGENCY_LABELS,
} from '@/types/kpm';
import { BesoinStockSelector } from './BesoinStockSelector';

export interface BesoinLigneInput {
  id: string;
  designation: string;
  category: BesoinLigneCategory;
  unit: string;
  quantity: number;
  urgency: BesoinUrgency;
  justification: string;
  article_stock_id?: string | null;
}

interface BesoinLignesTableProps {
  lignes: BesoinLigneInput[];
  onChange: (lignes: BesoinLigneInput[]) => void;
  readOnly?: boolean;
  showStockSelector?: boolean;
}

const UNITS = ['pc', 'lot', 'jour', 'course', 'heure', 'unité', 'kg', 'litre', 'mètre', 'boîte'];

export function BesoinLignesTable({ lignes, onChange, readOnly = false, showStockSelector = true }: BesoinLignesTableProps) {
  const addLigne = () => {
    const newLigne: BesoinLigneInput = {
      id: `temp-${crypto.randomUUID()}`,
      designation: '',
      category: 'materiel',
      unit: 'unité',
      quantity: 1,
      urgency: 'normale',
      justification: '',
      article_stock_id: null,
    };
    onChange([...lignes, newLigne]);
  };

  const addLigneFromStock = (article: { id: string; designation: string; unit: string; description?: string | null }) => {
    const newLigne: BesoinLigneInput = {
      id: `temp-${crypto.randomUUID()}`,
      designation: article.designation,
      category: 'materiel',
      unit: article.unit, // Utilise l'unité de l'article stock
      quantity: 1,
      urgency: 'normale',
      justification: '',
      article_stock_id: article.id,
    };
    onChange([...lignes, newLigne]);
  };

  const updateLigne = (id: string, field: keyof BesoinLigneInput, value: any) => {
    onChange(
      lignes.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const removeLigne = (id: string) => {
    if (lignes.length > 1) {
      onChange(lignes.filter((l) => l.id !== id));
    }
  };

  const unlinkFromStock = (id: string) => {
    onChange(
      lignes.map((l) => (l.id === id ? { ...l, article_stock_id: null } : l))
    );
  };

  // Get already linked stock article ids to exclude from selector
  const linkedStockIds = lignes
    .filter((l) => l.article_stock_id)
    .map((l) => l.article_stock_id as string);

  const urgencyColors: Record<BesoinUrgency, string> = {
    normale: 'bg-muted text-muted-foreground',
    urgente: 'bg-warning/10 text-warning',
    critique: 'bg-destructive/10 text-destructive',
  };

  if (readOnly) {
    return (
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Désignation</TableHead>
              <TableHead className="w-[120px]">Catégorie</TableHead>
              <TableHead className="w-[80px]">Qté</TableHead>
              <TableHead className="w-[100px]">Unité</TableHead>
              <TableHead className="w-[120px]">Urgence</TableHead>
              <TableHead>Justification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((ligne) => (
              <TableRow key={ligne.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {ligne.article_stock_id && (
                      <span title="Article du stock">
                        <Package className="h-4 w-4 text-primary" />
                      </span>
                    )}
                    {ligne.designation}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {BESOIN_LIGNE_CATEGORY_LABELS[ligne.category]}
                  </Badge>
                </TableCell>
                <TableCell>{ligne.quantity}</TableCell>
                <TableCell>{ligne.unit}</TableCell>
                <TableCell>
                  <Badge className={urgencyColors[ligne.urgency]}>
                    {ligne.urgency === 'critique' && <AlertTriangle className="mr-1 h-3 w-3" />}
                    {BESOIN_URGENCY_LABELS[ligne.urgency].split(' ')[0]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {ligne.justification || '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Désignation *</TableHead>
              <TableHead className="w-[130px]">Catégorie *</TableHead>
              <TableHead className="w-[80px]">Qté *</TableHead>
              <TableHead className="w-[110px]">Unité *</TableHead>
              <TableHead className="w-[130px]">Urgence *</TableHead>
              <TableHead className="min-w-[180px]">Justification</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lignes.map((ligne, index) => {
              const needsJustification = ligne.urgency !== 'normale';
              const isFromStock = !!ligne.article_stock_id;
              return (
                <TableRow key={ligne.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {isFromStock && (
                          <Badge variant="secondary" className="gap-1 shrink-0">
                            <Package className="h-3 w-3" />
                            Stock
                          </Badge>
                        )}
                        <Input
                          placeholder="Ex: Câbles RJ45 Cat6 blindés"
                          value={ligne.designation}
                          onChange={(e) => updateLigne(ligne.id, 'designation', e.target.value)}
                          className="min-w-[180px]"
                          disabled={isFromStock}
                        />
                      </div>
                      {isFromStock && (
                        <button
                          type="button"
                          onClick={() => unlinkFromStock(ligne.id)}
                          className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                        >
                          <Link2 className="h-3 w-3" />
                          Délier du stock
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={ligne.category}
                      onValueChange={(v) => updateLigne(ligne.id, 'category', v as BesoinLigneCategory)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(BESOIN_LIGNE_CATEGORY_LABELS) as BesoinLigneCategory[]).map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {BESOIN_LIGNE_CATEGORY_LABELS[cat]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={ligne.quantity}
                      onChange={(e) => updateLigne(ligne.id, 'quantity', parseFloat(e.target.value) || 1)}
                      className="w-[70px]"
                    />
                  </TableCell>
                  <TableCell>
                    {isFromStock ? (
                      <Input
                        value={ligne.unit}
                        disabled
                        className="w-full bg-muted"
                        title="L'unité est définie par l'article du stock"
                      />
                    ) : (
                      <Select
                        value={ligne.unit}
                        onValueChange={(v) => updateLigne(ligne.id, 'unit', v)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((unit) => (
                            <SelectItem key={unit} value={unit}>
                              {unit}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={ligne.urgency}
                      onValueChange={(v) => updateLigne(ligne.id, 'urgency', v as BesoinUrgency)}
                    >
                      <SelectTrigger className={`w-full ${ligne.urgency === 'critique' ? 'border-destructive' : ''}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(BESOIN_URGENCY_LABELS) as BesoinUrgency[]).map((urg) => (
                          <SelectItem key={urg} value={urg}>
                            {BESOIN_URGENCY_LABELS[urg].split(' ')[0]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Textarea
                      placeholder={needsJustification ? 'Obligatoire si urgent/critique' : 'Optionnel'}
                      value={ligne.justification}
                      onChange={(e) => updateLigne(ligne.id, 'justification', e.target.value)}
                      rows={1}
                      className={`min-w-[160px] resize-none ${needsJustification && !ligne.justification ? 'border-destructive' : ''}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLigne(ligne.id)}
                      disabled={lignes.length === 1}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={addLigne} className="flex-1 sm:flex-none">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter manuellement
        </Button>
        {showStockSelector && (
          <BesoinStockSelector
            onSelect={addLigneFromStock}
            excludeIds={linkedStockIds}
            buttonText="Ajouter depuis le stock"
            buttonVariant="secondary"
          />
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        ⚠️ Aucun prix n'est demandé. La logistique se chargera du chiffrage lors de la conversion en DA.
        {showStockSelector && ' Les articles du stock gardent leur unité d\'origine.'}
      </p>
    </div>
  );
}
