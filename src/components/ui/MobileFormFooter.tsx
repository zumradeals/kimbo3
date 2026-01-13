import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileFormFooterProps {
  children: ReactNode;
  className?: string;
}

/**
 * A sticky footer component for forms on mobile.
 * On desktop, it renders normally at the end of the form.
 * On mobile, it sticks to the bottom of the viewport.
 */
export function MobileFormFooter({ children, className }: MobileFormFooterProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]",
          className
        )}
      >
        <div className="flex items-center justify-end gap-3">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-end gap-3", className)}>
      {children}
    </div>
  );
}

/**
 * Add this as bottom padding to the form container when using MobileFormFooter
 * to prevent content from being hidden behind the sticky footer on mobile.
 */
export function MobileFormSpacer() {
  const isMobile = useIsMobile();
  
  if (!isMobile) return null;
  
  return <div className="h-20" />;
}
