import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { AppRole } from '@/types/kpm';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: AppRole[];
  children?: NavItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Tableau de bord',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Administration',
    href: '/admin',
    icon: Shield,
    roles: ['admin'],
    children: [
      { label: 'Utilisateurs', href: '/admin/users', icon: Users, roles: ['admin'] },
      { label: 'Départements', href: '/admin/departments', icon: Building2, roles: ['admin'] },
      { label: 'Rôles & Permissions', href: '/admin/roles', icon: Shield, roles: ['admin'] },
      { label: 'Paramètres', href: '/admin/settings', icon: Settings, roles: ['admin'] },
    ],
  },
  {
    label: 'Journal d\'audit',
    href: '/audit',
    icon: FileText,
    roles: ['admin'],
  },
  {
    label: 'Rapports',
    href: '/reports',
    icon: BarChart3,
    roles: ['admin', 'dg', 'daf'],
  },
];

// Modules métier (désactivés pour l'instant)
const businessModules: NavItem[] = [
  { label: 'Besoins', href: '/besoins', icon: ClipboardList },
  { label: 'Demandes d\'achat', href: '/da', icon: FileText },
  { label: 'Stock', href: '/stock', icon: Package },
  { label: 'Comptabilité', href: '/compta', icon: Wallet },
];

export function Sidebar() {
  const { profile, roles, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['/admin']);

  const hasAccess = (item: NavItem): boolean => {
    if (!item.roles) return true;
    return item.roles.some((role) => roles.includes(role));
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
    const isExpanded = expandedItems.includes(item.href);
    const active = isActive(item.href);

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
            {item.children!.map((child) => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

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

          {/* Modules métier (désactivés) */}
          <div className="mt-6 border-t border-sidebar-border pt-4">
            <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-muted">
              Modules métier
            </p>
            {businessModules.map((item) => (
              <div
                key={item.href}
                className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-muted/50"
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs">(bientôt)</span>
              </div>
            ))}
          </div>
        </nav>

        {/* User & Logout */}
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-sidebar-foreground">
              {profile?.first_name} {profile?.last_name}
            </p>
            <p className="text-xs text-sidebar-muted">{profile?.email}</p>
          </div>
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
