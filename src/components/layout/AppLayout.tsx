import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="min-h-screen p-4 pt-20 lg:p-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
