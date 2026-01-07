import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  BesoinTypeEnum,
  BesoinLigneCategory,
  BesoinUrgency,
  BESOIN_TYPE_ENUM_LABELS,
  OBJETS_INTERDITS,
  OBJET_BESOIN_EXEMPLES,
  ROLES_CAN_CREATE_BESOIN,
} from '@/types/kpm';
import { ArrowLeft, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BesoinLignesTable } from '@/components/besoins/BesoinLignesTable';
import { BesoinAttachmentsUpload } from '@/components/besoins/BesoinAttachmentsUpload';
import { ProjetSelector } from '@/components/ui/ProjetSelector';

interface LigneInput {
  id: string;
  designation: string;
  category: BesoinLigneCategory;
  unit: string;
  quantity: number;
  urgency: BesoinUrgency;
  justification: string;
  article_stock_id?: string | null;
}

interface AttachmentInput {
  id: string;
  file?: File;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
}

export default function BesoinCreate() {
  const { user, profile, roles } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Bloc A - Identité du besoin
  const [siteProjet, setSiteProjet] = useState('');
  const [projetId, setProjetId] = useState('');
  const [typeBesoin, setTypeBesoin] = useState<BesoinTypeEnum>('achat');

  // Bloc B - Objet clair du besoin
  const [objetBesoin, setObjetBesoin] = useState('');
  const [objetError, setObjetError] = useState('');

  // Bloc C - Lignes de besoin
  const [lignes, setLignes] = useState<LigneInput[]>([
    {
      id: crypto.randomUUID(),
      designation: '',
      category: 'materiel',
      unit: 'unité',
      quantity: 1,
      urgency: 'normale',
      justification: '',
      article_stock_id: null,
    },
  ]);

  // Bloc D - Contraintes logistiques
  const [fournisseurImpose, setFournisseurImpose] = useState(false);
  const [fournisseurNom, setFournisseurNom] = useState('');
  const [fournisseurContact, setFournisseurContact] = useState('');
  const [dateSouhaitee, setDateSouhaitee] = useState('');
  const [lieuLivraison, setLieuLivraison] = useState('');
  const [besoinVehicule, setBesoinVehicule] = useState(false);
  const [besoinAvanceCaisse, setBesoinAvanceCaisse] = useState(false);
  const [avanceCaisseMontant, setAvanceCaisseMontant] = useState('');

  // Bloc E - Pièces jointes
  const [attachments, setAttachments] = useState<AttachmentInput[]>([]);

  // Bloc F - Confirmation
  const [confirmationEngagement, setConfirmationEngagement] = useState(false);

  const canCreate = roles.some((r) => ROLES_CAN_CREATE_BESOIN.includes(r));

  // Validation de l'objet du besoin
  const validateObjet = (value: string) => {
    const lowerValue = value.toLowerCase().trim();
    
    if (lowerValue.length < 10) {
      setObjetError('L\'objet doit contenir au moins 10 caractères');
      return false;
    }

    for (const interdit of OBJETS_INTERDITS) {
      if (lowerValue === interdit || (lowerValue.length < 20 && lowerValue.includes(interdit))) {
        setObjetError(`"${interdit}" n'est pas un objet valide. Soyez plus précis.`);
        return false;
      }
    }

    setObjetError('');
    return true;
  };

  const handleObjetChange = (value: string) => {
    setObjetBesoin(value);
    if (value.length > 5) {
      validateObjet(value);
    } else {
      setObjetError('');
    }
  };

  // Validation des lignes
  const validateLignes = (): boolean => {
    for (const ligne of lignes) {
      if (!ligne.designation.trim()) {
        toast({
          title: 'Erreur',
          description: 'Toutes les lignes doivent avoir une désignation.',
          variant: 'destructive',
        });
        return false;
      }
      if (ligne.quantity <= 0) {
        toast({
          title: 'Erreur',
          description: 'Les quantités doivent être supérieures à 0.',
          variant: 'destructive',
        });
        return false;
      }
      if ((ligne.urgency === 'urgente' || ligne.urgency === 'critique') && !ligne.justification.trim()) {
        toast({
          title: 'Justification requise',
          description: `La ligne "${ligne.designation}" nécessite une justification pour le niveau d'urgence sélectionné.`,
          variant: 'destructive',
        });
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!validateObjet(objetBesoin)) {
      toast({ title: 'Erreur', description: 'L\'objet du besoin n\'est pas valide.', variant: 'destructive' });
      return;
    }

    if (!validateLignes()) return;

    if (!confirmationEngagement) {
      toast({
        title: 'Confirmation requise',
        description: 'Vous devez confirmer que ce besoin est exact et exploitable.',
        variant: 'destructive',
      });
      return;
    }

    if (!profile?.department_id) {
      toast({
        title: 'Erreur',
        description: 'Vous devez être rattaché à un département pour créer un besoin.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Créer le besoin principal
      // Calculer l'urgence maximale des lignes
      const urgencyPriority: Record<BesoinUrgency, number> = { normale: 0, urgente: 1, critique: 2 };
      const maxUrgency = lignes.reduce((max, l) => 
        urgencyPriority[l.urgency] > urgencyPriority[max] ? l.urgency : max
      , 'normale' as BesoinUrgency);

      const { data: besoinData, error: besoinError } = await supabase
        .from('besoins')
        .insert({
          title: objetBesoin.substring(0, 200),
          description: `Type: ${BESOIN_TYPE_ENUM_LABELS[typeBesoin]}\n${lignes.map(l => `- ${l.designation} (${l.quantity} ${l.unit})`).join('\n')}`,
          category: 'materiel', // Legacy field
          urgency: maxUrgency,
          desired_date: dateSouhaitee || null,
          user_id: user?.id,
          department_id: profile.department_id,
          // Nouveaux champs
          projet_id: projetId || null,
          site_projet: siteProjet.trim(),
          objet_besoin: objetBesoin.trim(),
          fournisseur_impose: fournisseurImpose,
          fournisseur_impose_nom: fournisseurImpose ? fournisseurNom.trim() : null,
          fournisseur_impose_contact: fournisseurImpose ? fournisseurContact.trim() : null,
          lieu_livraison: lieuLivraison.trim() || null,
          besoin_vehicule: besoinVehicule,
          besoin_avance_caisse: besoinAvanceCaisse,
          avance_caisse_montant: besoinAvanceCaisse && avanceCaisseMontant ? parseFloat(avanceCaisseMontant) : null,
          confirmation_engagement: confirmationEngagement,
        })
        .select()
        .single();

      if (besoinError) throw besoinError;

      const besoinId = besoinData.id;

      // 2. Insérer les lignes
      const lignesInsert = lignes.map((l) => ({
        besoin_id: besoinId,
        designation: l.designation.trim(),
        category: l.category,
        unit: l.unit,
        quantity: l.quantity,
        urgency: l.urgency,
        justification: l.justification.trim() || null,
        article_stock_id: l.article_stock_id || null,
      }));

      const { data: insertedLignes, error: lignesError } = await supabase
        .from('besoin_lignes')
        .insert(lignesInsert)
        .select();

      if (lignesError) throw lignesError;
      
      // Check if RLS silently blocked the insert
      if (!insertedLignes || insertedLignes.length !== lignesInsert.length) {
        console.error('Lignes insert mismatch:', { expected: lignesInsert.length, inserted: insertedLignes?.length });
        throw new Error('Impossible de créer les lignes de besoin. Permissions insuffisantes.');
      }

      // 3. Upload et insérer les pièces jointes
      if (attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.file) {
            const fileExt = attachment.file_name.split('.').pop();
            const fileName = `${besoinId}/${Date.now()}-${crypto.randomUUID()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('besoins-attachments')
              .upload(fileName, attachment.file);

            if (uploadError) {
              console.error('Upload error:', uploadError);
              continue;
            }

            const { data: urlData } = supabase.storage
              .from('besoins-attachments')
              .getPublicUrl(fileName);

            await supabase
              .from('besoin_attachments')
              .insert({
                besoin_id: besoinId,
                file_url: urlData.publicUrl,
                file_name: attachment.file_name,
                file_type: attachment.file_type,
                file_size: attachment.file_size,
              });
          }
        }
      }

      toast({
        title: 'Besoin créé avec succès',
        description: 'Votre besoin a été transmis à la Logistique pour traitement.',
      });

      navigate(`/besoins/${besoinId}`);
    } catch (error: any) {
      console.error('Error creating besoin:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer le besoin.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canCreate) {
    return (
      <AppLayout>
        <AccessDenied message="Vous n'êtes pas autorisé à créer des besoins internes. Seuls les responsables de département peuvent exprimer un besoin." />
      </AppLayout>
    );
  }

  const hasCriticalLine = lignes.some((l) => l.urgency === 'critique');

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/besoins">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Nouveau besoin interne
            </h1>
            <p className="text-muted-foreground">
              Décrivez votre besoin de manière claire et exploitable
            </p>
          </div>
        </div>

        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Ce besoin n'engage aucun achat ni paiement</p>
              <p className="text-muted-foreground">
                Il s'agit d'une expression formelle transmise à la Logistique. 
                Vous n'avez pas à indiquer de prix. La conversion en Demande d'Achat sera faite par la Logistique.
              </p>
            </div>
          </CardContent>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* BLOC A - Identité du besoin */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  A
                </span>
                Identité du besoin
              </CardTitle>
              <CardDescription>Informations auto-remplies et contexte</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Champs auto-remplis */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Demandeur</Label>
                  <Input
                    value={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || profile?.email || 'Inconnu'}
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

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Date de la demande</Label>
                  <Input
                    value={new Date().toLocaleDateString('fr-FR')}
                    disabled
                    className="bg-muted"
                  />
                </div>
              <div className="space-y-2">
                <Label htmlFor="projet">Projet rattaché</Label>
                <ProjetSelector
                  value={projetId}
                  onChange={(id, projet) => {
                    setProjetId(id);
                    // Auto-compléter le site si un projet avec location est sélectionné
                    if (projet?.location && !siteProjet.trim()) {
                      setSiteProjet(projet.location);
                    }
                  }}
                  placeholder="Sélectionner un projet..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site_projet">Site / Lieu concerné</Label>
                <Input
                  id="site_projet"
                  placeholder="Ex: Chantier Douala Nord, Bureau DG, Atelier..."
                  value={siteProjet}
                  onChange={(e) => setSiteProjet(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  S'auto-complète si un projet avec localisation est sélectionné
                </p>
              </div>
              </div>

              {/* Type de besoin */}
              <div className="space-y-2">
                <Label htmlFor="type_besoin">Type de besoin *</Label>
                <Select
                  value={typeBesoin}
                  onValueChange={(v) => setTypeBesoin(v as BesoinTypeEnum)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BESOIN_TYPE_ENUM_LABELS) as BesoinTypeEnum[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        {BESOIN_TYPE_ENUM_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Le type conditionne certains champs ultérieurs
                </p>
              </div>
            </CardContent>
          </Card>

          {/* BLOC B - Objet clair du besoin */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  B
                </span>
                Objet du besoin
              </CardTitle>
              <CardDescription>Résumé clair et précis (max 120 caractères)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="objet_besoin">Objet du besoin *</Label>
                <Input
                  id="objet_besoin"
                  placeholder={OBJET_BESOIN_EXEMPLES[Math.floor(Math.random() * OBJET_BESOIN_EXEMPLES.length)]}
                  value={objetBesoin}
                  onChange={(e) => handleObjetChange(e.target.value.slice(0, 120))}
                  maxLength={120}
                  className={objetError ? 'border-destructive' : ''}
                  required
                />
                <div className="flex items-center justify-between">
                  <p className={`text-xs ${objetError ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {objetError || `${objetBesoin.length}/120 caractères`}
                  </p>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Exemples valides :</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {OBJET_BESOIN_EXEMPLES.map((ex, i) => (
                    <li key={i}>• {ex}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* BLOC C - Lignes de besoin */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  C
                </span>
                Lignes de besoin
              </CardTitle>
              <CardDescription>Détaillez chaque article ou service nécessaire</CardDescription>
            </CardHeader>
            <CardContent>
              <BesoinLignesTable lignes={lignes} onChange={setLignes} showCatalog={true} />
            </CardContent>
          </Card>

          {/* BLOC D - Contraintes logistiques */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  D
                </span>
                Contraintes logistiques
              </CardTitle>
              <CardDescription>Informations complémentaires pour le traitement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Fournisseur imposé */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="fournisseur_impose"
                    checked={fournisseurImpose}
                    onCheckedChange={(v) => setFournisseurImpose(v === true)}
                  />
                  <Label htmlFor="fournisseur_impose" className="cursor-pointer">
                    Fournisseur imposé
                  </Label>
                </div>
                {fournisseurImpose && (
                  <div className="ml-6 grid gap-3 sm:grid-cols-2">
                    <Input
                      placeholder="Nom du fournisseur"
                      value={fournisseurNom}
                      onChange={(e) => setFournisseurNom(e.target.value)}
                    />
                    <Input
                      placeholder="Contact (tél, email...)"
                      value={fournisseurContact}
                      onChange={(e) => setFournisseurContact(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Date souhaitée et lieu */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date_souhaitee">Date souhaitée</Label>
                  <Input
                    id="date_souhaitee"
                    type="date"
                    value={dateSouhaitee}
                    onChange={(e) => setDateSouhaitee(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lieu_livraison">Lieu de livraison / exécution</Label>
                  <Input
                    id="lieu_livraison"
                    placeholder="Ex: Bureau DG, Chantier Zone A..."
                    value={lieuLivraison}
                    onChange={(e) => setLieuLivraison(e.target.value)}
                  />
                </div>
              </div>

              {/* Options véhicule et avance */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="besoin_vehicule"
                    checked={besoinVehicule}
                    onCheckedChange={(v) => setBesoinVehicule(v === true)}
                  />
                  <Label htmlFor="besoin_vehicule" className="cursor-pointer">
                    Besoin de véhicule
                  </Label>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="besoin_avance"
                      checked={besoinAvanceCaisse}
                      onCheckedChange={(v) => setBesoinAvanceCaisse(v === true)}
                    />
                    <Label htmlFor="besoin_avance" className="cursor-pointer">
                      Besoin d'avance de caisse
                    </Label>
                  </div>
                  {besoinAvanceCaisse && (
                    <Input
                      type="number"
                      placeholder="Montant estimatif (non engageant)"
                      value={avanceCaisseMontant}
                      onChange={(e) => setAvanceCaisseMontant(e.target.value)}
                      className="ml-6"
                    />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* BLOC E - Pièces jointes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  E
                </span>
                Pièces jointes
              </CardTitle>
              <CardDescription>Images, devis, captures d'écran, documents PDF</CardDescription>
            </CardHeader>
            <CardContent>
              <BesoinAttachmentsUpload attachments={attachments} onChange={setAttachments} />
            </CardContent>
          </Card>

          {/* BLOC F - Validation & Engagement */}
          <Card className={hasCriticalLine ? 'border-destructive/50' : ''}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  F
                </span>
                Validation & Engagement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasCriticalLine && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="flex items-start gap-3 py-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">
                      <strong>Attention :</strong> Ce besoin contient une ou plusieurs lignes marquées comme "Critiques". 
                      Un usage abusif de ce niveau peut entraîner un rejet systématique.
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-start space-x-3 rounded-md border p-4">
                <Checkbox
                  id="confirmation"
                  checked={confirmationEngagement}
                  onCheckedChange={(v) => setConfirmationEngagement(v === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <Label htmlFor="confirmation" className="cursor-pointer font-medium">
                    Je confirme que ce besoin est exact et exploitable par la logistique
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    En cochant cette case, vous attestez que les informations fournies sont complètes et sincères.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Link to="/besoins" className="flex-1 sm:flex-none">
                  <Button type="button" variant="outline" className="w-full">
                    Annuler
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isSubmitting || !confirmationEngagement}
                  className="flex-1 sm:flex-none"
                >
                  {isSubmitting ? (
                    'Envoi en cours...'
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Soumettre le besoin
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
