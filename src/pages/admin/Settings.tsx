import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Setting } from '@/types/kpm';
import { Save, Building, DollarSign, FileText, Bell, Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface SettingGroup {
  key: string;
  label: string;
  icon: React.ElementType;
  settings: Setting[];
}

export default function AdminSettings() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .order('category')
        .order('key');

      if (error) throw error;
      
      setSettings(data || []);
      
      // Initialize edited values
      const values: Record<string, string> = {};
      (data || []).forEach((s) => {
        values[s.key] = s.value || '';
      });
      setEditedValues(values);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSettings();
    }
  }, [isAdmin]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Update each changed setting
      const updates = settings.filter((s) => editedValues[s.key] !== s.value);
      
      for (const setting of updates) {
        const { error } = await supabase
          .from('settings')
          .update({
            value: editedValues[setting.key],
            updated_by: user?.id,
          })
          .eq('id', setting.id);

        if (error) throw error;
      }

      toast({
        title: 'Paramètres enregistrés',
        description: `${updates.length} paramètre(s) mis à jour.`,
      });

      fetchSettings();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder les paramètres.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'general':
        return Building;
      case 'thresholds':
        return DollarSign;
      case 'references':
        return FileText;
      case 'notifications':
        return Bell;
      case 'workflow':
        return Settings2;
      default:
        return Building;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'general':
        return 'Général';
      case 'thresholds':
        return 'Seuils de validation';
      case 'references':
        return 'Formats de références';
      case 'notifications':
        return 'Notifications';
      case 'workflow':
        return 'Workflow';
      default:
        return category;
    }
  };

  // Group settings by category
  const groupedSettings = settings.reduce((acc, setting) => {
    const category = setting.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(setting);
    return acc;
  }, {} as Record<string, Setting[]>);

  const hasChanges = settings.some((s) => editedValues[s.key] !== s.value);

  if (!isAdmin) {
    return (
      <AppLayout>
        <AccessDenied message="Seuls les administrateurs peuvent modifier les paramètres système." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Paramètres système
            </h1>
            <p className="text-muted-foreground">
              Configuration globale de KPM SYSTEME
            </p>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6">
            {Object.entries(groupedSettings).map(([category, categorySettings]) => {
              const Icon = getCategoryIcon(category);
              return (
                <Card key={category}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{getCategoryLabel(category)}</CardTitle>
                        <CardDescription>
                          {category === 'thresholds' && 'Définissez les montants de validation par niveau.'}
                          {category === 'general' && 'Informations générales de l\'entreprise.'}
                          {category === 'references' && 'Préfixes pour la génération des références.'}
                          {category === 'workflow' && 'Configuration des étapes du circuit de validation.'}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {categorySettings.map((setting) => {
                        const isBooleanSetting = setting.value === 'true' || setting.value === 'false';
                        
                        if (isBooleanSetting) {
                          return (
                            <div key={setting.id} className="flex items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <Label htmlFor={setting.key}>
                                  {setting.description || setting.key}
                                </Label>
                                {setting.key === 'aal_bypass_enabled' && (
                                  <p className="text-xs text-muted-foreground">
                                    Quand activé, les DA, BL et NDF passent directement au DAF sans validation AAL
                                  </p>
                                )}
                              </div>
                              <Switch
                                id={setting.key}
                                checked={editedValues[setting.key] === 'true'}
                                onCheckedChange={(checked) =>
                                  setEditedValues({
                                    ...editedValues,
                                    [setting.key]: checked ? 'true' : 'false',
                                  })
                                }
                              />
                            </div>
                          );
                        }

                        return (
                          <div key={setting.id} className="space-y-2">
                            <Label htmlFor={setting.key}>
                              {setting.description || setting.key}
                            </Label>
                            <Input
                              id={setting.key}
                              value={editedValues[setting.key] || ''}
                              onChange={(e) =>
                                setEditedValues({
                                  ...editedValues,
                                  [setting.key]: e.target.value,
                                })
                              }
                              placeholder={setting.description || ''}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
