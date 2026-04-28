import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText, Inbox, ShoppingCart, Truck, CreditCard,
  CheckCircle2, Clock, XCircle, ArrowRight, Activity, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type StepKey = 'expression' | 'besoin' | 'da' | 'bl' | 'paiement';
type StepState = 'done' | 'current' | 'pending' | 'rejected';

interface TrackedRequest {
  id: string;
  type: 'expression' | 'besoin';
  reference: string;
  title: string;
  createdAt: string;
  steps: Record<StepKey, { state: StepState; label: string; date?: string; ref?: string }>;
  currentLabel: string;
  ctaLink: string;
}

const STEP_ICONS: Record<StepKey, React.ElementType> = {
  expression: FileText,
  besoin: Inbox,
  da: ShoppingCart,
  bl: Truck,
  paiement: CreditCard,
};

const STEP_TITLES: Record<StepKey, string> = {
  expression: 'Expression',
  besoin: 'Besoin',
  da: 'DA',
  bl: 'BL',
  paiement: 'Payée',
};

function StepBadge({ stepKey, state, label, date }: { stepKey: StepKey; state: StepState; label: string; date?: string }) {
  const Icon = STEP_ICONS[stepKey];
  const styles =
    state === 'done'
      ? 'bg-success/10 text-success border-success/30'
      : state === 'current'
      ? 'bg-primary/15 text-primary border-primary/40 ring-2 ring-primary/30 animate-pulse'
      : state === 'rejected'
      ? 'bg-destructive/10 text-destructive border-destructive/30'
      : 'bg-muted/50 text-muted-foreground border-muted';

  const StateIcon =
    state === 'done' ? CheckCircle2 : state === 'rejected' ? XCircle : state === 'current' ? Clock : null;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[72px]">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-full border-2', styles)}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-foreground">{STEP_TITLES[stepKey]}</p>
      <p className="text-[10px] text-center text-muted-foreground line-clamp-2 max-w-[80px]">
        {label}
      </p>
      {date && <p className="text-[9px] text-muted-foreground">{date}</p>}
      {StateIcon && state !== 'current' && <StateIcon className={cn('h-3 w-3', state === 'done' ? 'text-success' : 'text-destructive')} />}
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex-1 mx-1 mt-5">
      <div className={cn('h-0.5 w-full', active ? 'bg-success' : 'bg-muted')} />
    </div>
  );
}

export function MyRequestsTracker() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TrackedRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchData();
    // realtime: refresh on any change to user's flow
    const ch = supabase
      .channel('my-tracker')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expressions_besoin', filter: `user_id=eq.${user.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'besoins', filter: `user_id=eq.${user.id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'demandes_achat' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    setLoading(true);

    // 1. Expressions de besoin de l'utilisateur (90 derniers jours)
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expressions } = await supabase
      .from('expressions_besoin')
      .select('id, titre, nom_article, status, created_at, besoin_id, validated_at, sent_to_logistics_at, rejected_at')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(15);

    // 2. Besoins de l'utilisateur (qu'ils proviennent ou non d'une expression)
    const { data: besoins } = await supabase
      .from('besoins')
      .select('id, title, objet_besoin, status, created_at, decided_at, taken_at')
      .eq('user_id', user.id)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(15);

    const besoinIds = (besoins || []).map((b) => b.id);
    const expressionBesoinIds = (expressions || []).map((e) => e.besoin_id).filter(Boolean) as string[];
    const allBesoinIds = Array.from(new Set([...besoinIds, ...expressionBesoinIds]));

    // 3. DA liées
    const { data: das } = allBesoinIds.length
      ? await supabase
          .from('demandes_achat')
          .select('id, reference, status, besoin_id, created_at, validated_finance_at, comptabilise_at, payment_class')
          .in('besoin_id', allBesoinIds)
      : { data: [] as any[] };

    // 4. BL liés
    const { data: bls } = allBesoinIds.length
      ? await supabase
          .from('bons_livraison')
          .select('id, reference, status, besoin_id, delivered_at')
          .in('besoin_id', allBesoinIds)
      : { data: [] as any[] };

    const dasByBesoin = new Map<string, any[]>();
    (das || []).forEach((d) => {
      if (!d.besoin_id) return;
      const arr = dasByBesoin.get(d.besoin_id) || [];
      arr.push(d);
      dasByBesoin.set(d.besoin_id, arr);
    });
    const blsByBesoin = new Map<string, any[]>();
    (bls || []).forEach((b) => {
      const arr = blsByBesoin.get(b.besoin_id) || [];
      arr.push(b);
      blsByBesoin.set(b.besoin_id, arr);
    });
    const besoinById = new Map((besoins || []).map((b) => [b.id, b]));

    const tracked: TrackedRequest[] = [];

    // Build from expressions (vue Yvette : démarre par l'expression)
    (expressions || []).forEach((exp) => {
      const besoin = exp.besoin_id ? besoinById.get(exp.besoin_id) : null;
      const linkedDAs = exp.besoin_id ? dasByBesoin.get(exp.besoin_id) || [] : [];
      const linkedBLs = exp.besoin_id ? blsByBesoin.get(exp.besoin_id) || [] : [];
      tracked.push(buildTracker({
        id: exp.id,
        type: 'expression',
        reference: exp.titre || exp.nom_article || 'Expression',
        title: exp.nom_article || exp.titre || '',
        createdAt: exp.created_at,
        expression: exp,
        besoin,
        das: linkedDAs,
        bls: linkedBLs,
      }));
    });

    // Add besoins not derived from an expression
    const expressionBesoinSet = new Set(expressionBesoinIds);
    (besoins || []).forEach((b) => {
      if (expressionBesoinSet.has(b.id)) return;
      const linkedDAs = dasByBesoin.get(b.id) || [];
      const linkedBLs = blsByBesoin.get(b.id) || [];
      tracked.push(buildTracker({
        id: b.id,
        type: 'besoin',
        reference: b.objet_besoin || b.title || 'Besoin',
        title: b.title || '',
        createdAt: b.created_at,
        expression: null,
        besoin: b,
        das: linkedDAs,
        bls: linkedBLs,
      }));
    });

    tracked.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setRequests(tracked.slice(0, 8));
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="border-primary/30">
        <CardHeader><CardTitle className="text-base">Suivi de mes demandes</CardTitle></CardHeader>
        <CardContent><div className="h-32 animate-pulse bg-muted rounded" /></CardContent>
      </Card>
    );
  }

  if (requests.length === 0) return null;

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2 text-foreground">
            <Activity className="h-5 w-5 text-primary" />
            Suivi complet de mes demandes
            <Badge variant="secondary" className="ml-1">{requests.length}</Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            De l'expression de besoin jusqu'au paiement — mis à jour en temps réel
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r) => (
          <div key={`${r.type}-${r.id}`} className="rounded-lg border bg-card p-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-foreground truncate">{r.reference}</p>
                <p className="text-xs text-muted-foreground">
                  Créée le {format(new Date(r.createdAt), 'dd MMM yyyy', { locale: fr })} · <span className="font-medium text-primary">{r.currentLabel}</span>
                </p>
              </div>
              <Link to={r.ctaLink}>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <Eye className="h-3 w-3 mr-1" /> Détails
                </Button>
              </Link>
            </div>
            <div className="flex items-start overflow-x-auto pb-1">
              {(['expression', 'besoin', 'da', 'bl', 'paiement'] as StepKey[]).map((key, i, arr) => (
                <div key={key} className="flex items-start flex-1 min-w-fit">
                  <StepBadge stepKey={key} state={r.steps[key].state} label={r.steps[key].label} date={r.steps[key].date} />
                  {i < arr.length - 1 && <Connector active={r.steps[arr[i + 1]].state === 'done' || r.steps[key].state === 'done'} />}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function buildTracker(args: {
  id: string;
  type: 'expression' | 'besoin';
  reference: string;
  title: string;
  createdAt: string;
  expression: any | null;
  besoin: any | null;
  das: any[];
  bls: any[];
}): TrackedRequest {
  const { id, type, reference, title, createdAt, expression, besoin, das, bls } = args;

  const fmt = (d?: string | null) => (d ? format(new Date(d), 'dd/MM', { locale: fr }) : undefined);

  // Expression step
  const expStep = expression
    ? expression.status === 'rejete_departement'
      ? { state: 'rejected' as StepState, label: 'Rejetée', date: fmt(expression.rejected_at) }
      : expression.status === 'envoye_logistique' || expression.besoin_id
      ? { state: 'done' as StepState, label: 'Transmise', date: fmt(expression.sent_to_logistics_at || expression.validated_at) }
      : expression.status === 'valide_departement'
      ? { state: 'done' as StepState, label: 'Validée', date: fmt(expression.validated_at) }
      : expression.status === 'soumis' || expression.status === 'en_examen'
      ? { state: 'current' as StepState, label: 'En validation chef', date: fmt(expression.created_at) }
      : { state: 'current' as StepState, label: 'Brouillon', date: fmt(expression.created_at) }
    : { state: 'done' as StepState, label: 'Non requise', date: undefined };

  // Besoin step
  const besoinStep = besoin
    ? besoin.status === 'refuse'
      ? { state: 'rejected' as StepState, label: 'Refusé', date: fmt(besoin.decided_at) }
      : besoin.status === 'accepte'
      ? { state: 'done' as StepState, label: 'Accepté', date: fmt(besoin.decided_at) }
      : besoin.status === 'pris_en_charge'
      ? { state: 'current' as StepState, label: 'Pris en charge', date: fmt(besoin.taken_at) }
      : besoin.status === 'cree'
      ? { state: 'current' as StepState, label: 'En attente logistique', date: fmt(besoin.created_at) }
      : { state: 'pending' as StepState, label: besoin.status }
    : expStep.state === 'done' && expStep.label !== 'Non requise'
    ? { state: 'pending' as StepState, label: 'En attente' }
    : { state: 'pending' as StepState, label: '—' };

  // DA step (prendre la plus avancée)
  const orderDA = ['brouillon', 'soumise', 'en_analyse', 'en_revision_achats', 'chiffree', 'soumise_validation', 'en_attente_dg', 'retour_aal', 'rejetee_aal', 'validee_finance', 'refusee_finance', 'rejetee', 'rejetee_comptabilite', 'payee', 'annulee'];
  const sortedDAs = [...das].sort((a, b) => orderDA.indexOf(b.status) - orderDA.indexOf(a.status));
  const topDA = sortedDAs[0];
  const daStep = topDA
    ? topDA.status === 'payee'
      ? { state: 'done' as StepState, label: topDA.reference, date: fmt(topDA.comptabilise_at), ref: topDA.reference }
      : ['rejetee', 'rejetee_comptabilite', 'refusee_finance', 'rejetee_aal', 'annulee'].includes(topDA.status)
      ? { state: 'rejected' as StepState, label: 'Rejetée', date: fmt(topDA.created_at), ref: topDA.reference }
      : topDA.status === 'validee_finance'
      ? { state: 'done' as StepState, label: 'Validée DAF', date: fmt(topDA.validated_finance_at), ref: topDA.reference }
      : ['soumise_validation', 'en_attente_dg'].includes(topDA.status)
      ? { state: 'current' as StepState, label: 'En validation DAF/DG', date: fmt(topDA.created_at), ref: topDA.reference }
      : ['chiffree', 'en_analyse', 'en_revision_achats', 'retour_aal'].includes(topDA.status)
      ? { state: 'current' as StepState, label: 'Traitement Achats', date: fmt(topDA.created_at), ref: topDA.reference }
      : { state: 'current' as StepState, label: topDA.status, date: fmt(topDA.created_at), ref: topDA.reference }
    : { state: 'pending' as StepState, label: '—' };

  // BL step
  const orderBL = ['brouillon', 'prepare', 'soumis_aal', 'soumis_daf', 'valide_daf', 'pret_a_livrer', 'livree_partiellement', 'livre', 'cloture', 'refusee', 'refuse_daf'];
  const sortedBLs = [...bls].sort((a, b) => orderBL.indexOf(b.status) - orderBL.indexOf(a.status));
  const topBL = sortedBLs[0];
  const blStep = topBL
    ? ['livre', 'cloture'].includes(topBL.status)
      ? { state: 'done' as StepState, label: 'Livré', date: fmt(topBL.delivered_at) }
      : topBL.status === 'livree_partiellement'
      ? { state: 'current' as StepState, label: 'Livraison partielle', date: fmt(topBL.delivered_at) }
      : ['refusee', 'refuse_daf'].includes(topBL.status)
      ? { state: 'rejected' as StepState, label: 'BL refusé' }
      : { state: 'current' as StepState, label: 'BL en cours' }
    : { state: 'pending' as StepState, label: '—' };

  // Paiement step
  const paidDA = sortedDAs.find((d) => d.status === 'payee');
  const paiementStep = paidDA
    ? { state: 'done' as StepState, label: 'Payée', date: fmt(paidDA.comptabilise_at) }
    : daStep.state === 'done' && daStep.label === 'Validée DAF'
    ? { state: 'current' as StepState, label: 'Attente compta' }
    : { state: 'pending' as StepState, label: '—' };

  // Current label (étape la plus avancée)
  const orderedSteps: { key: StepKey; step: any }[] = [
    { key: 'expression', step: expStep },
    { key: 'besoin', step: besoinStep },
    { key: 'da', step: daStep },
    { key: 'bl', step: blStep },
    { key: 'paiement', step: paiementStep },
  ];
  let currentLabel = 'En cours';
  for (let i = orderedSteps.length - 1; i >= 0; i--) {
    const s = orderedSteps[i].step;
    if (s.state === 'done' || s.state === 'current' || s.state === 'rejected') {
      currentLabel = `${STEP_TITLES[orderedSteps[i].key]} — ${s.label}`;
      break;
    }
  }

  // CTA link (lien le plus pertinent)
  let ctaLink = '/expressions-besoin';
  if (paidDA || topDA) ctaLink = `/demandes-achat/${(paidDA || topDA).id}`;
  else if (besoin) ctaLink = `/besoins/${besoin.id}`;
  else if (type === 'expression') ctaLink = `/expressions-besoin/${id}`;

  return {
    id,
    type,
    reference,
    title,
    createdAt,
    steps: {
      expression: expStep,
      besoin: besoinStep,
      da: daStep,
      bl: blStep,
      paiement: paiementStep,
    },
    currentLabel,
    ctaLink,
  };
}