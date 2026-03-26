import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';

export default function ImmobilisationCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    designation: '',
    description: '',
    type: 'corporel' as 'corporel' | 'incorporel',
    classe_comptable: 2,
    category: '',
    date_acquisition: new Date().toISOString().split('T')[0],
    mode_acquisition: 'achat_da' as string,
    valeur_acquisition: 0,
    devise: 'XOF',
    emplacement: '',
    department_id: '',
    etat: 'neuf' as string,
    duree_vie_estimee: undefined as number | undefined,
    numero_serie: '',
    affecte_a: '',
    da_id: '',
    article_stock_id: '',
  });

  const { data: departments } = useQuery({
    queryKey: ['departments-active'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('*').eq('is_active', true).order('name');
      return data || [];
    },
  });

  const { data: users } = useQuery({
    queryKey: ['profiles-for-affectation'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, first_name, last_name, matricule').order('first_name');
      return data || [];
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.designation.trim()) { toast.error('La désignation est obligatoire'); return; }
    if (!user) return;

    setLoading(true);
    try {
      const insertData: any = {
        designation: form.designation.trim(),
        description: form.description.trim() || null,
        type: form.type,
        classe_comptable: form.classe_comptable,
        category: form.category.trim() || null,
        date_acquisition: form.date_acquisition,
        mode_acquisition: form.mode_acquisition,
        valeur_acquisition: form.valeur_acquisition,
        devise: form.devise,
        emplacement: form.emplacement.trim() || null,
        department_id: form.department_id || null,
        etat: form.etat,
        duree_vie_estimee: form.duree_vie_estimee || null,
        numero_serie: form.numero_serie.trim() || null,
        affecte_a: form.affecte_a || null,
        da_id: form.da_id || null,
        article_stock_id: form.article_stock_id || null,
        created_by: user.id,
        code: '', // trigger will generate
      };

      const { data, error } = await supabase.from('immobilisations').insert(insertData).select('id').single();
      if (error) throw error;
      toast.success('Immobilisation créée avec succès');
      navigate(`/immobilisations/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-bold">Nouvelle immobilisation</h1>
            <p className="text-sm text-muted-foreground">Enregistrer un nouveau bien durable</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identification */}
          <Card>
            <CardHeader><CardTitle className="text-base">Identification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Désignation *</Label>
                <Input value={form.designation} onChange={e => update('designation', e.target.value)} placeholder="Ex: Ordinateur portable Dell Latitude" required />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => update('description', e.target.value)} placeholder="Description détaillée..." rows={3} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Type *</Label>
                  <Select value={form.type} onValueChange={v => update('type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corporel">🏗️ Corporel</SelectItem>
                      <SelectItem value="incorporel">💻 Incorporel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Classe comptable</Label>
                  <Select value={form.classe_comptable.toString()} onValueChange={v => update('classe_comptable', parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">Classe 2 - Immobilisations</SelectItem>
                      <SelectItem value="3">Classe 3 - Stocks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Catégorie</Label>
                  <Input value={form.category} onChange={e => update('category', e.target.value)} placeholder="Ex: Matériel informatique" />
                </div>
                <div>
                  <Label>N° de série</Label>
                  <Input value={form.numero_serie} onChange={e => update('numero_serie', e.target.value)} placeholder="Si applicable" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Acquisition */}
          <Card>
            <CardHeader><CardTitle className="text-base">Acquisition</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Date d'acquisition *</Label>
                  <Input type="date" value={form.date_acquisition} onChange={e => update('date_acquisition', e.target.value)} required />
                </div>
                <div>
                  <Label>Mode d'acquisition *</Label>
                  <Select value={form.mode_acquisition} onValueChange={v => update('mode_acquisition', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="achat_da">Achat (DA)</SelectItem>
                      <SelectItem value="sortie_stock">Sortie de stock</SelectItem>
                      <SelectItem value="don">Don</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Valeur d'acquisition (FCFA) *</Label>
                  <Input type="number" min={0} value={form.valeur_acquisition} onChange={e => update('valeur_acquisition', parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <Label>Durée de vie estimée (mois)</Label>
                  <Input type="number" min={1} value={form.duree_vie_estimee || ''} onChange={e => update('duree_vie_estimee', parseInt(e.target.value) || undefined)} placeholder="Ex: 60" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Localisation & Affectation */}
          <Card>
            <CardHeader><CardTitle className="text-base">Localisation & Affectation</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Emplacement</Label>
                  <Input value={form.emplacement} onChange={e => update('emplacement', e.target.value)} placeholder="Ex: Bureau 201, Siège Abidjan" />
                </div>
                <div>
                  <Label>Département</Label>
                  <Select value={form.department_id} onValueChange={v => update('department_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Affecté à</Label>
                  <Select value={form.affecte_a} onValueChange={v => update('affecte_a', v)}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un utilisateur..." /></SelectTrigger>
                    <SelectContent>
                      {users?.map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.first_name} {u.last_name} {u.matricule ? `(${u.matricule})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>État initial</Label>
                  <Select value={form.etat} onValueChange={v => update('etat', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neuf">Neuf</SelectItem>
                      <SelectItem value="bon">Bon état</SelectItem>
                      <SelectItem value="use">Usé</SelectItem>
                      <SelectItem value="en_panne">En panne</SelectItem>
                      <SelectItem value="hors_service">Hors service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Annuler</Button>
            <Button type="submit" disabled={loading}>
              <Save className="mr-2 h-4 w-4" />{loading ? 'Création...' : 'Créer l\'immobilisation'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
