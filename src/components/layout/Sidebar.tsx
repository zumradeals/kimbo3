import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  LayoutDashboard,
  Users,
  Building2,
  Shield,
  Settings,
  FileText,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Package,
  Wallet,
  BarChart3,
  ChevronDown,
  FolderKanban,
  Receipt,
  Ruler,
  BookOpen,
  Warehouse,
  MessageSquarePlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  module?: string; // Permission module to check
  permission?: string; // Specific permission code to check
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Tableau de bord',
    href: '/dashboard',
    icon: LayoutDashboard,
    module: 'dashboard',
  },
  {
    label: 'Utilisateurs',
    href: '/utilisateurs',
    icon: Users,
  },
  {
    label: 'Administration',
    href: '/admin',
    icon: Shield,
    module: 'administration',
    children: [
      { label: 'Gestion utilisateurs', href: '/admin/users', icon: Users, permission: 'administration.gerer_users' },
      { label: 'Départements', href: '/admin/departments', icon: Building2, permission: 'administration.gerer_departements' },
      { label: 'Rôles & Permissions', href: '/admin/roles', icon: Shield, permission: 'administration.gerer_roles' },
      { label: 'Unités de mesure', href: '/admin/units', icon: Ruler, permission: 'administration.gerer_unites' },
      { label: 'Modes paiement', href: '/admin/payment-categories', icon: Wallet, permission: 'administration.gerer_modes_paiement' },
      { label: 'Plan comptable', href: '/admin/comptes-comptables', icon: BookOpen, permission: 'administration.gerer_plan_comptable' },
      { label: 'Paramètres', href: '/admin/settings', icon: Settings, permission: 'administration.gerer_parametres' },
    ],
  },
  {
    label: 'Journal d\'audit',
    href: '/audit',
    icon: FileText,
    module: 'audit',
  },
  {
    label: 'Rapports',
    href: '/reports',
    icon: BarChart3,
    module: 'rapports',
  },
];

// Module navigation items
const moduleNavItems: NavItem[] = [
  {
    label: 'Expressions de besoin',
    href: '/expressions-besoin',
    icon: MessageSquarePlus,
    module: 'expressions',
  },
  {
    label: 'Besoins internes',
    href: '/besoins',
    icon: ClipboardList,
    module: 'besoins',
  },
  {
    label: 'Demandes d\'achat',
    href: '/demandes-achat',
    icon: FileText,
    module: 'da',
  },
  {
    label: 'Bons de livraison',
    href: '/bons-livraison',
    icon: Package,
    module: 'bl',
  },
  {
    label: 'Fournisseurs',
    href: '/fournisseurs',
    icon: Building2,
    module: 'fournisseurs',
  },
  {
    label: 'Comptabilité',
    href: '/comptabilite',
    icon: Wallet,
    module: 'comptabilite',
  },
  {
    label: 'Stock',
    href: '/stock',
    icon: Package,
    module: 'stock',
    children: [
      { label: 'Articles', href: '/stock', icon: Package },
      { label: 'Mouvements', href: '/stock/mouvements', icon: Warehouse },
      { label: 'Catégories', href: '/stock/categories', icon: FolderKanban },
    ],
  },
  {
    label: 'Projets / Chantiers',
    href: '/projets',
    icon: FolderKanban,
    module: 'projets',
  },
  {
    label: 'Notes de frais',
    href: '/notes-frais',
    icon: Receipt,
    module: 'notes_frais',
  },
  {
    label: 'Caisse',
    href: '/caisse',
    icon: Wallet,
    module: 'caisse',
  },
];

export function Sidebar() {
  const { profile, signOut, isAdmin } = useAuth();
  const { canViewModule, hasPermission, isLoading: permissionsLoading } = usePermissions();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['/admin']);

  const hasAccess = (item: NavItem): boolean => {
    // Admin always has access
    if (isAdmin) return true;
    
    // Check specific permission first
    if (item.permission) {
      return hasPermission(item.permission);
    }
    
    // Check module access
    if (item.module) {
      return canViewModule(item.module);
    }
    
    return true;
  };

  const toggleExpanded = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href]
    );
  };

  const isActive = (href: string) => location.pathname === href || location.pathname.startsWith(href + '/');

  const renderNavItem = (item: NavItem, depth = 0) => {
    if (!hasAccess(item)) return null;

    const hasChildren = item.children && item.children.length > 0;
    const visibleChildren = hasChildren 
      ? item.children!.filter(child => hasAccess(child))
      : [];
    const isExpanded = expandedItems.includes(item.href);
    const active = isActive(item.href);

    // Don't show parent if no children are accessible
    if (hasChildren && visibleChildren.length === 0) return null;

    return (
      <div key={item.href}>
        {hasChildren ? (
          <button
            onClick={() => toggleExpanded(item.href)}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
            style={{ paddingLeft: `${12 + depth * 12}px` }}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
            />
          </button>
        ) : (
          <Link
            to={item.href}
            onClick={() => setIsOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
            )}
            style={{ paddingLeft: `${12 + depth * 12}px` }}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        )}
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {visibleChildren.map((child) => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Filter module items based on permissions
  const visibleModuleItems = moduleNavItems.filter(item => hasAccess(item));

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar transition-transform lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sidebar-primary">
            <span className="text-lg font-bold text-sidebar-primary-foreground">K</span>
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold text-sidebar-foreground">
              KPM SYSTEME
            </h1>
            <p className="text-xs text-sidebar-muted">KIMBO AFRICA SA</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => renderNavItem(item))}
          
          {/* Module items */}
          {visibleModuleItems.length > 0 && (
            <>
              <div className="mt-4 mb-2 px-3">
                <p className="text-xs font-medium uppercase tracking-wider text-sidebar-muted">
                  Modules métier
                </p>
              </div>
              {visibleModuleItems.map((item) => renderNavItem(item))}
            </>
          )}
        </nav>

        {/* User & Logout */}
        <div className="border-t border-sidebar-border p-4">
          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="mb-3 block rounded-md px-3 py-2 hover:bg-sidebar-accent/50 transition-colors"
          >
            <p className="text-sm font-medium text-sidebar-foreground">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-sidebar-muted">{profile?.email}</p>
            <p className="text-xs text-primary mt-1">Voir mon profil →</p>
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </aside>
    </>
  );
}
