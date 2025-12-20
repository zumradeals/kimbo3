import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, Check, CheckCheck, Trash2, ExternalLink, Filter,
  FileText, Package, CreditCard, AlertTriangle, Clock
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const NOTIFICATION_TYPES = {
  besoin: ['besoin_created', 'besoin_status_changed'],
  da: ['da_created', 'da_submitted', 'da_rejected', 'da_validation_required', 'da_validated_finance', 'da_refused_finance', 'da_revision_requested', 'da_ready_accounting', 'da_paid', 'da_submitted_validation', 'da_rejected_comptabilite'],
  bl: ['bl_created', 'BL livré', 'Livraison partielle'],
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'besoin' | 'da' | 'bl'>('all');

  const fetchNotifications = async () => {
    if (!user) return;

    setIsLoading(true);
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (filter === 'unread') {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;

    if (error) {
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les notifications',
        variant: 'destructive',
      });
    } else {
      setNotifications(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    // Realtime subscription
    if (!user) return;

    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        {
          event: '*',
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
  }, [user, filter]);

  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
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
      toast({
        title: 'Succès',
        description: 'Toutes les notifications ont été marquées comme lues',
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    if (NOTIFICATION_TYPES.besoin.includes(type)) {
      return <FileText className="h-5 w-5" />;
    }
    if (NOTIFICATION_TYPES.da.includes(type)) {
      return <CreditCard className="h-5 w-5" />;
    }
    if (NOTIFICATION_TYPES.bl.includes(type)) {
      return <Package className="h-5 w-5" />;
    }
    return <Bell className="h-5 w-5" />;
  };

  const getNotificationColor = (type: string) => {
    if (type.includes('rejected') || type.includes('refused') || type.includes('refusee')) {
      return 'bg-destructive/10 text-destructive border-destructive/20';
    }
    if (type.includes('validated') || type.includes('paid') || type.includes('accepte') || type === 'BL livré') {
      return 'bg-success/10 text-success border-success/20';
    }
    if (type.includes('revision') || type.includes('validation') || type === 'Livraison partielle') {
      return 'bg-warning/10 text-warning border-warning/20';
    }
    return 'bg-primary/10 text-primary border-primary/20';
  };

  const getTypeLabel = (type: string) => {
    if (NOTIFICATION_TYPES.besoin.includes(type)) return 'Besoin';
    if (NOTIFICATION_TYPES.da.includes(type)) return 'DA';
    if (NOTIFICATION_TYPES.bl.includes(type)) return 'BL';
    return 'Système';
  };

  const filteredNotifications = notifications.filter(n => {
    if (typeFilter === 'all') return true;
    return NOTIFICATION_TYPES[typeFilter]?.includes(n.type);
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Notifications
            </h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 
                ? `${unreadCount} notification${unreadCount > 1 ? 's' : ''} non lue${unreadCount > 1 ? 's' : ''}`
                : 'Toutes vos notifications sont lues'
              }
            </p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={markAllAsRead} variant="outline">
              <CheckCheck className="mr-2 h-4 w-4" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
            <TabsList>
              <TabsTrigger value="all">Toutes</TabsTrigger>
              <TabsTrigger value="unread">Non lues ({unreadCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <Tabs value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Tous types</TabsTrigger>
              <TabsTrigger value="besoin">Besoins</TabsTrigger>
              <TabsTrigger value="da">DA</TabsTrigger>
              <TabsTrigger value="bl">BL</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Notifications List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Bell className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <h3 className="font-medium text-muted-foreground">Aucune notification</h3>
                <p className="text-sm text-muted-foreground/70">
                  {filter === 'unread' 
                    ? 'Vous avez lu toutes vos notifications'
                    : 'Vous n\'avez pas encore reçu de notifications'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      'flex gap-4 p-4 transition-colors hover:bg-muted/30',
                      !notification.is_read && 'bg-accent/20'
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
                        getNotificationColor(notification.type)
                      )}
                    >
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium leading-tight">
                            {notification.title}
                          </h4>
                          <Badge variant="outline" className="mt-1 text-xs">
                            {getTypeLabel(notification.type)}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {!notification.is_read && (
                            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                          )}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {notification.message}
                      </p>
                      <div className="flex items-center gap-3 pt-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(notification.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                        </span>
                        {notification.link && (
                          <Link
                            to={notification.link}
                            onClick={() => markAsRead(notification.id)}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Voir le détail
                          </Link>
                        )}
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1 text-xs"
                            onClick={() => markAsRead(notification.id)}
                          >
                            <Check className="mr-1 h-3 w-3" />
                            Marquer comme lu
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
