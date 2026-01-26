import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
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
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  module?: string;
  permission?: string;
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
    label: 'Tiers',
    href: '/tiers',
    icon: Users,
    module: 'fournisseurs',
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
      { label: 'Entrepôts', href: '/entrepots', icon: Warehouse },
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
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['/admin']);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
    }
  }, [location.pathname, isMobile]);

  const hasAccess = (item: NavItem): boolean => {
    if (isAdmin) return true;
    if (item.permission) {
      return hasPermission(item.permission);
    }
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

    if (hasChildren && visibleChildren.length === 0) return null;

    return (
      <div key={item.href}>
        {hasChildren ? (
          <button
            onClick={() => toggleExpanded(item.href)}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 active:bg-sidebar-accent/70'
            )}
            style={{ paddingLeft: `${12 + depth * 12}px` }}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
            />
          </button>
        ) : (
          <Link
            to={item.href}
            onClick={() => isMobile && setIsOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50 active:bg-sidebar-accent/70'
            )}
            style={{ paddingLeft: `${12 + depth * 12}px` }}
          >
            <item.icon className="h-5 w-5" />
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

  const visibleModuleItems = moduleNavItems.filter(item => hasAccess(item));

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-sidebar-primary">
          <span className="text-lg font-bold text-sidebar-primary-foreground">K</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-lg font-bold text-sidebar-foreground truncate">
            KPM SYSTEME
          </h1>
          <p className="text-xs text-sidebar-muted">KIMBO AFRICA SA</p>
        </div>
        {isMobile && (
          <DrawerClose asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </DrawerClose>
        )}
      </div>

      {/* Quick Actions Link - Mobile only */}
      {isMobile && (
        <div className="px-4 pt-4">
          <Link
            to="/actions-rapides"
            onClick={() => setIsOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-3 text-sm font-medium text-primary transition-colors touch-manipulation',
              'hover:bg-primary/20 active:bg-primary/30',
              isActive('/actions-rapides') && 'bg-primary text-primary-foreground'
            )}
          >
            <Zap className="h-5 w-5" />
            <span>Actions rapides</span>
          </Link>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems.map((item) => renderNavItem(item))}
        
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
          onClick={() => isMobile && setIsOpen(false)}
          className="mb-3 block rounded-md px-3 py-2 hover:bg-sidebar-accent/50 active:bg-sidebar-accent/70 transition-colors touch-manipulation"
        >
          <p className="text-sm font-medium text-sidebar-foreground truncate">
            {profile?.first_name} {profile?.last_name}
          </p>
          <p className="text-xs text-sidebar-muted truncate">{profile?.email}</p>
          <p className="text-xs text-primary mt-1">Voir mon profil →</p>
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground touch-manipulation"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </>
  );

  // Mobile: Use Drawer component
  if (isMobile) {
    return (
      <>
        {/* Mobile toggle button - Fixed position */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed left-4 top-4 z-50 h-10 w-10 rounded-lg bg-background/80 backdrop-blur-sm shadow-sm border lg:hidden"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Drawer open={isOpen} onOpenChange={setIsOpen} direction="left">
          <DrawerContent 
            className="h-full w-[280px] max-w-[85vw] rounded-none border-r border-sidebar-border"
            style={{ 
              position: 'fixed', 
              left: 0, 
              top: 0, 
              bottom: 0,
              borderRadius: 0,
              backgroundColor: 'hsl(24, 58%, 27%)',
            }}
          >
            <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
              <SidebarContent />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Desktop: Standard sidebar
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar lg:flex">
      <SidebarContent />
    </aside>
  );
}
