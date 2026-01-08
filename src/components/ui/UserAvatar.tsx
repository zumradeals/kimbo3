import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  photoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  className?: string;
}

const sizeClasses = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
  xxl: 'h-32 w-32 text-3xl',
};

export function UserAvatar({ photoUrl, firstName, lastName, size = 'md', className }: UserAvatarProps) {
  const initials = `${firstName?.charAt(0) || ''}${lastName?.charAt(0) || ''}`.toUpperCase();
  
  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={photoUrl || undefined} alt={`${firstName} ${lastName}`} />
      <AvatarFallback className="bg-primary/10 text-primary">
        {initials || <User className="h-1/2 w-1/2" />}
      </AvatarFallback>
    </Avatar>
  );
}
