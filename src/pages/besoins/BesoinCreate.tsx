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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  BesoinCategory,
  BesoinUrgency,
  BESOIN_CATEGORY_LABELS,
  BESOIN_URGENCY_LABELS,
  ROLES_CAN_CREATE_BESOIN,
} from '@/types/kpm';
import { ArrowLeft, AlertTriangle, Info, Paperclip, X, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BesoinCreate() {
  const { user, profile, roles } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '' as BesoinCategory | '',
    urgency: 'normale' as BesoinUrgency,
    desired_date: '',
  });

  const canCreate = roles.some((r) => ROLES_CAN_CREATE_BESOIN.includes(r));

  if (!canCreate) {
    return (
      <AppLayout>
        <AccessDenied message="Vous n'êtes pas autorisé à créer des besoins internes. Seuls les responsables de département peuvent exprimer un besoin." />
      </AppLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim() || !form.description.trim() || !form.category) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires.',
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
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      // Upload attachment if present
      if (attachment) {
        setIsUploading(true);
        const fileExt = attachment.name.split('.').pop();
        const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('besoins-attachments')
          .upload(fileName, attachment);

        if (uploadError) {
          throw new Error('Échec de l\'upload du fichier: ' + uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from('besoins-attachments')
          .getPublicUrl(fileName);
        
        attachmentUrl = urlData.publicUrl;
        attachmentName = attachment.name;
        setIsUploading(false);
      }

      const { data, error } = await supabase
        .from('besoins')
        .insert({
          title: form.title.trim(),
          description: form.description.trim(),
          category: form.category,
          urgency: form.urgency,
          desired_date: form.desired_date || null,
          user_id: user?.id,
          department_id: profile.department_id,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      toast({
        title: 'Besoin créé',
        description: 'Votre besoin a été transmis à la Logistique.',
      });

      navigate(`/besoins/${data.id}`);
    } catch (error: any) {
      console.error('Error creating besoin:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de créer le besoin.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Fichier trop volumineux',
          description: 'La taille maximale autorisée est de 10 Mo.',
          variant: 'destructive',
        });
        return;
      }
      setAttachment(file);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-2xl space-y-6">
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
              Exprimez un besoin pour votre département
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
                Il s'agit d'une demande opérationnelle transmise à la Logistique pour évaluation. 
                Seule une Demande d'Achat approuvée pourra engager des dépenses.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du besoin</CardTitle>
            <CardDescription>
              Décrivez clairement votre besoin. Plus il est précis, plus le traitement sera rapide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Département (auto) */}
              <div className="space-y-2">
                <Label>Département émetteur</Label>
                <Input
                  value={profile?.department?.name || 'Non assigné'}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Déduit automatiquement de votre profil
                </p>
              </div>

              {/* Titre */}
              <div className="space-y-2">
                <Label htmlFor="title">Titre du besoin *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Ordinateur portable pour nouveau collaborateur"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description détaillée *</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez précisément le besoin : contexte, spécifications, quantité si applicable..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={5}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground">
                  {form.description.length}/2000 caractères
                </p>
              </div>

              {/* Catégorie & Urgence */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie *</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) => setForm({ ...form, category: value as BesoinCategory })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(BESOIN_CATEGORY_LABELS) as BesoinCategory[]).map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {BESOIN_CATEGORY_LABELS[cat]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="urgency">Niveau d'urgence *</Label>
                  <Select
                    value={form.urgency}
                    onValueChange={(value) => setForm({ ...form, urgency: value as BesoinUrgency })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(BESOIN_URGENCY_LABELS) as BesoinUrgency[]).map((urg) => (
                        <SelectItem key={urg} value={urg}>
                          {BESOIN_URGENCY_LABELS[urg]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date souhaitée */}
              <div className="space-y-2">
                <Label htmlFor="desired_date">Date souhaitée (optionnel)</Label>
                <Input
                  id="desired_date"
                  type="date"
                  value={form.desired_date}
                  onChange={(e) => setForm({ ...form, desired_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Pièce jointe */}
              <div className="space-y-2">
                <Label htmlFor="attachment">Pièce jointe (optionnel)</Label>
                {!attachment ? (
                  <div className="relative">
                    <input
                      id="attachment"
                      type="file"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                    />
                    <div className="flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-muted-foreground/25 p-4 hover:border-primary/50 transition-colors cursor-pointer">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Cliquez pour ajouter un fichier (max 10 Mo)
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
                    <Paperclip className="h-4 w-4 text-primary" />
                    <span className="flex-1 text-sm truncate">{attachment.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(attachment.size / 1024).toFixed(0)} Ko
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={removeAttachment}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Formats acceptés : PDF, Word, Excel, Images (PNG, JPG)
                </p>
              </div>

              {/* Urgence critique warning */}
              {form.urgency === 'critique' && (
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="flex items-start gap-3 py-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <p className="text-sm text-destructive">
                      <strong>Attention :</strong> Les besoins critiques doivent être exceptionnels. 
                      Un usage abusif peut entraîner un rejet systématique.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Link to="/besoins" className="flex-1 sm:flex-none">
                  <Button type="button" variant="outline" className="w-full">
                    Annuler
                  </Button>
                </Link>
                <Button type="submit" disabled={isSubmitting || isUploading} className="flex-1 sm:flex-none">
                  {isUploading ? 'Upload du fichier...' : isSubmitting ? 'Envoi en cours...' : 'Soumettre le besoin'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
