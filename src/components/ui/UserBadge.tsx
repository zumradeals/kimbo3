import { Link } from 'react-router-dom';
import { UserAvatar } from './UserAvatar';
import { cn } from '@/lib/utils';

interface UserBadgeProps {
  userId?: string;
  photoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fonction?: string | null;
  departmentName?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showDepartment?: boolean;
  showFonction?: boolean;
  linkToProfile?: boolean;
  className?: string;
}

export function UserBadge({
  userId,
  photoUrl,
  firstName,
  lastName,
  fonction,
  departmentName,
  size = 'md',
  showDepartment = false,
  showFonction = false,
  linkToProfile = false,
  className,
}: UserBadgeProps) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Utilisateur';
  
  const avatarSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'md';
  
  const content = (
    <div className={cn('flex items-center gap-2', className)}>
      <UserAvatar
        photoUrl={photoUrl}
        firstName={firstName}
        lastName={lastName}
        size={avatarSize}
      />
      <div className="min-w-0 flex-1">
        <p className={cn(
          'font-medium text-foreground truncate',
          size === 'sm' && 'text-sm',
          size === 'lg' && 'text-base'
        )}>
          {fullName}
        </p>
        {(showFonction && fonction) && (
          <p className="text-xs text-muted-foreground truncate">{fonction}</p>
        )}
        {(showDepartment && departmentName) && (
          <p className="text-xs text-muted-foreground truncate">{departmentName}</p>
        )}
      </div>
    </div>
  );

  if (linkToProfile && userId) {
    return (
      <Link to={`/admin/users?user=${userId}`} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
