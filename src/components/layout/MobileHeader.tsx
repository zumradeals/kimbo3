import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { GlobalSearch } from '@/components/ui/GlobalSearch';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { LogOut, User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function MobileHeader() {
  const { profile, signOut } = useAuth();

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background/95 backdrop-blur-sm px-3 lg:hidden">
      {/* Left: Logo compact */}
      <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary">
          <span className="text-sm font-bold text-secondary-foreground">K</span>
        </div>
        <span className="font-serif text-sm font-bold text-foreground">KPM</span>
      </Link>

      {/* Right: Search + Notifications + Avatar */}
      <div className="flex items-center gap-1.5">
        <GlobalSearch />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center rounded-full ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 touch-manipulation">
              <UserAvatar
                firstName={profile?.first_name}
                lastName={profile?.last_name}
                photoUrl={profile?.photo_url}
                size="sm"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium truncate">
                {profile?.first_name} {profile?.last_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.email}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                <User className="h-4 w-4" />
                Mon profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={signOut}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
