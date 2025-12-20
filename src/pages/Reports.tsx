import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { ModulePending } from '@/components/ui/ModulePending';

export default function Reports() {
  const { roles } = useAuth();
  
  const hasAccess = roles.some(r => ['admin', 'dg', 'daf'].includes(r));

  if (!hasAccess) {
    return (
      <AppLayout>
        <AccessDenied message="Vous n'avez pas les permissions nécessaires pour accéder aux rapports." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Rapports
          </h1>
          <p className="text-muted-foreground">
            Analyse et synthèse des données
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8">
          <ModulePending
            title="Module en cours de développement"
            description="Les rapports seront disponibles une fois les modules métier (Besoins, DA, Stock, Comptabilité) activés."
          />
        </div>
      </div>
    </AppLayout>
  );
}
