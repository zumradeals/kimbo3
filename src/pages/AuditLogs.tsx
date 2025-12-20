import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { ModulePending } from '@/components/ui/ModulePending';

export default function AuditLogs() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <AppLayout>
        <AccessDenied message="Seuls les administrateurs peuvent consulter le journal d'audit." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Journal d'audit
          </h1>
          <p className="text-muted-foreground">
            Historique des actions système
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8">
          <ModulePending
            title="Module en cours de développement"
            description="Le journal d'audit sera disponible une fois les modules métier activés. Il enregistrera toutes les actions importantes effectuées dans le système."
          />
        </div>
      </div>
    </AppLayout>
  );
}
