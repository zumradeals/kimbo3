import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, ExternalLink, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getNotificationSoundMuted, setNotificationSoundMuted } from '@/hooks/useNotificationAlert';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(getNotificationSoundMuted);

  // Sync mute state across components
  useEffect(() => {
    const handler = (e: Event) => {
      setIsMuted((e as CustomEvent).detail.muted);
    };
    window.addEventListener('kpm-sound-mute-change', handler);
    return () => window.removeEventListener('kpm-sound-mute-change', handler);
  }, []);

  const toggleMute = () => {
    const newMuted = !isMuted;
    setNotificationSoundMuted(newMuted);
    setIsMuted(newMuted);
  };

  const fetchNotifications = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to realtime notifications
    if (!user) return;

    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const getNotificationIcon = (type: string) => {
    // Different colors based on notification type
    switch (type) {
      case 'besoin_created':
      case 'da_created':
      case 'bl_created':
        return 'bg-primary/10 text-primary';
      case 'besoin_status_changed':
      case 'da_validated_finance':
      case 'da_paid':
        return 'bg-success/10 text-success';
      case 'da_rejected':
      case 'da_refused_finance':
      case 'da_rejected_comptabilite':
        return 'bg-destructive/10 text-destructive';
      case 'da_revision_requested':
      case 'da_validation_required':
        return 'bg-warning/10 text-warning';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  // Marquer toutes comme lues quand le popover est ouvert
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && unreadCount > 0) {
      // Marquer toutes les notifications comme lues après un court délai
      setTimeout(() => {
        markAllAsRead();
      }, 1500);
    }
  };

  return (
    <div className="flex items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isMuted && "text-muted-foreground")}
            onClick={toggleMute}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isMuted ? 'Réactiver le son des notifications' : 'Désactiver le son des notifications'}
        </TooltipContent>
      </Tooltip>
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-destructive-foreground animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b p-3">
          <h4 className="font-medium">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs"
              onClick={markAllAsRead}
            >
              <Check className="mr-1 h-3 w-3" />
              Tout marquer lu
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
              <Bell className="mb-2 h-8 w-8 opacity-50" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'flex gap-3 p-3 transition-colors hover:bg-muted/50',
                    !notification.is_read && 'bg-accent/30'
                  )}
                  onClick={() => !notification.is_read && markAsRead(notification.id)}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      getNotificationIcon(notification.type)
                    )}
                  >
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-tight">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </span>
                      {notification.link && (
                        <Link
                          to={notification.link}
                          onClick={() => {
                            markAsRead(notification.id);
                            setIsOpen(false);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          Voir
                        </Link>
                      )}
                    </div>
                  </div>
                  {!notification.is_read && (
                    <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="border-t p-2">
          <Link
            to="/notifications"
            onClick={() => setIsOpen(false)}
            className="flex w-full items-center justify-center gap-1 rounded-md py-2 text-sm text-primary hover:bg-muted"
          >
            Voir toutes les notifications
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
    </div>
  );
}
