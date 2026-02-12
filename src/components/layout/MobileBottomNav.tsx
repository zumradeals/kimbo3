import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import {
  LayoutDashboard,
  ClipboardList,
  FileText,
  Package,
  MoreHorizontal,
} from 'lucide-react';

interface TabItem {
  label: string;
  href: string;
  icon: React.ElementType;
  module?: string;
}

const tabs: TabItem[] = [
  { label: 'Accueil', href: '/dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { label: 'Besoins', href: '/besoins', icon: ClipboardList, module: 'besoins' },
  { label: 'DA', href: '/demandes-achat', icon: FileText, module: 'da' },
  { label: 'Stock', href: '/stock', icon: Package, module: 'stock' },
];

interface MobileBottomNavProps {
  onMorePress: () => void;
}

export function MobileBottomNav({ onMorePress }: MobileBottomNavProps) {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { canViewModule } = usePermissions();

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + '/');

  const visibleTabs = tabs.filter((tab) => {
    if (isAdmin) return true;
    if (tab.module) return canViewModule(tab.module);
    return true;
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm safe-area-bottom lg:hidden">
      <div className="flex items-stretch justify-around">
        {visibleTabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors touch-manipulation',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className={cn('h-5 w-5', active && 'text-primary')} />
              <span>{tab.label}</span>
              {active && (
                <div className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" />
              )}
            </Link>
          );
        })}
        {/* More button */}
        <button
          onClick={onMorePress}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>Plus</span>
        </button>
      </div>
    </nav>
  );
}
