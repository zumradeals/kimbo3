import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';

interface ReadOnlyBadgeProps {
  className?: string;
}

export function ReadOnlyBadge({ className }: ReadOnlyBadgeProps) {
  return (
    <Badge 
      variant="secondary" 
      className={`bg-muted text-muted-foreground border border-muted-foreground/20 ${className || ''}`}
    >
      <Eye className="mr-1 h-3 w-3" />
      Lecture seule
    </Badge>
  );
}
