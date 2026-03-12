import { useNotificationAlert } from '@/hooks/useNotificationAlert';

/**
 * Global component that enables notification sounds and browser push.
 * Mount once in AppLayout to activate for all pages.
 */
export function NotificationAlertProvider() {
  // Just mounting this hook activates the sound + push system
  useNotificationAlert();
  return null;
}
