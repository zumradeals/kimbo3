import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { AccessDenied } from '@/components/ui/AccessDenied';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ROLE_LABELS, AppRole } from '@/types/kpm';
import { Shield, Check, X } from 'lucide-react';

// Matrice de permissions préparatoire (structure uniquement, pas de logique)
const PERMISSION_MATRIX: Record<string, { label: string; roles: AppRole[] }> = {
  view_dashboard: {
    label: 'Voir le tableau de bord',
    roles: ['admin', 'dg', 'daf', 'comptable', 'responsable_logistique', 'agent_logistique', 'responsable_achats', 'agent_achats', 'responsable_departement', 'employe', 'lecture_seule'],
  },
  manage_users: {
    label: 'Gérer les utilisateurs',
    roles: ['admin'],
  },
  manage_roles: {
    label: 'Gérer les rôles',
    roles: ['admin'],
  },
  manage_departments: {
    label: 'Gérer les départements',
    roles: ['admin'],
  },
  manage_settings: {
    label: 'Gérer les paramètres',
    roles: ['admin'],
  },
  view_audit_logs: {
    label: 'Voir le journal d\'audit',
    roles: ['admin'],
  },
  view_reports: {
    label: 'Voir les rapports',
    roles: ['admin', 'dg', 'daf'],
  },
  create_besoin: {
    label: 'Créer un besoin',
    roles: ['admin', 'dg', 'responsable_departement', 'employe'],
  },
  validate_besoin: {
    label: 'Valider un besoin',
    roles: ['admin', 'responsable_departement'],
  },
  create_da: {
    label: 'Créer une DA',
    roles: ['admin', 'responsable_logistique', 'agent_logistique'],
  },
  validate_da_achats: {
    label: 'Valider DA (Achats)',
    roles: ['admin', 'responsable_achats'],
  },
  validate_da_daf: {
    label: 'Valider DA (DAF)',
    roles: ['admin', 'daf'],
  },
  validate_da_dg: {
    label: 'Valider DA (DG)',
    roles: ['admin', 'dg'],
  },
  manage_stock: {
    label: 'Gérer le stock',
    roles: ['admin', 'responsable_logistique', 'agent_logistique'],
  },
  create_payment: {
    label: 'Créer un paiement',
    roles: ['admin', 'comptable'],
  },
  validate_payment: {
    label: 'Valider un paiement',
    roles: ['admin', 'daf'],
  },
};

const ALL_ROLES: AppRole[] = [
  'admin', 'dg', 'daf', 'comptable', 'responsable_logistique',
  'agent_logistique', 'responsable_achats', 'agent_achats',
  'responsable_departement', 'employe', 'lecture_seule'
];

export default function AdminRoles() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <AppLayout>
        <AccessDenied message="Seuls les administrateurs peuvent voir la matrice des permissions." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            Rôles & Permissions
          </h1>
          <p className="text-muted-foreground">
            Matrice des permissions par rôle (lecture seule)
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Matrice des permissions</CardTitle>
                <CardDescription>
                  Cette matrice est préparatoire. La modification dynamique sera disponible dans une prochaine version.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-medium">
                      Permission
                    </th>
                    {ALL_ROLES.map((role) => (
                      <th
                        key={role}
                        className="min-w-[100px] px-2 py-3 text-center text-xs font-medium"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="whitespace-nowrap">
                            {ROLE_LABELS[role].split(' ').slice(0, 2).join(' ')}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(PERMISSION_MATRIX).map(([code, { label, roles }]) => (
                    <tr key={code} className="border-b">
                      <td className="sticky left-0 z-10 bg-background px-4 py-3 font-medium">
                        {label}
                      </td>
                      {ALL_ROLES.map((role) => (
                        <td key={role} className="px-2 py-3 text-center">
                          {roles.includes(role) ? (
                            <Check className="mx-auto h-4 w-4 text-success" />
                          ) : (
                            <X className="mx-auto h-4 w-4 text-muted-foreground/30" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Info card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              <strong>Note :</strong> Cette matrice représente la structure des permissions prévue pour KPM SYSTEME. 
              Les permissions seront activées progressivement avec les modules métier correspondants 
              (Besoins, DA, Stock, Comptabilité).
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
