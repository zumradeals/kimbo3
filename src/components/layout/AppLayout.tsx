import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { MobileBottomNav } from './MobileBottomNav';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileOpenChange={setMobileMenuOpen} />
      
      {isMobile ? (
        <>
          <MobileHeader />
          <main>
            <div className="min-h-screen p-4 pt-16 pb-20">
              {children}
            </div>
          </main>
          <MobileBottomNav onMorePress={() => setMobileMenuOpen(true)} />
        </>
      ) : (
        <>
          {/* Desktop header */}
          <header className="fixed right-0 top-0 z-30 flex h-14 items-center justify-end gap-2 border-b bg-background/80 backdrop-blur-sm px-4 lg:left-64">
            <GlobalSearch />
            <NotificationBell />
          </header>
          <main className="lg:pl-64">
            <div className="min-h-screen p-4 pt-16 lg:p-8 lg:pt-20">
              {children}
            </div>
          </main>
        </>
      )}
    </div>
  );
}
