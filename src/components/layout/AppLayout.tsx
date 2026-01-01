import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { GlobalSearch } from '@/components/ui/GlobalSearch';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {/* Header with search and notification bell - mobile & desktop */}
      <header className="fixed right-0 top-0 z-30 flex h-16 items-center justify-end gap-3 px-4 lg:left-64">
        <GlobalSearch />
        <NotificationBell />
      </header>
      <main className="lg:pl-64">
        <div className="min-h-screen p-4 pt-20 lg:p-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
