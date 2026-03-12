import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SOUND_REPEAT_INTERVAL = 20000; // 20 seconds between repeat sounds
const NOTIFICATION_SOUND_FREQUENCY = 800; // Hz
const NOTIFICATION_SOUND_DURATION = 150; // ms per beep

/**
 * Generate a notification beep using Web Audio API (no external files needed)
 */
function playNotificationBeep() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playBeep = (startTime: number, frequency: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration / 1000);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + duration / 1000);
    };

    const now = audioContext.currentTime;
    // Triple beep pattern: beep-beep-beep
    playBeep(now, NOTIFICATION_SOUND_FREQUENCY, NOTIFICATION_SOUND_DURATION);
    playBeep(now + 0.2, NOTIFICATION_SOUND_FREQUENCY + 100, NOTIFICATION_SOUND_DURATION);
    playBeep(now + 0.4, NOTIFICATION_SOUND_FREQUENCY + 200, NOTIFICATION_SOUND_DURATION);
    
    // Cleanup after sounds finish
    setTimeout(() => audioContext.close(), 2000);
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
}

/**
 * Request browser push notification permission
 */
async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Show a browser push notification
 */
function showPushNotification(title: string, body: string, link?: string | null) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  
  try {
    const options: NotificationOptions & { renotify?: boolean } = {
      body,
      icon: '/logo-kimbo.png',
      badge: '/logo-kimbo.png',
      tag: 'kpm-notification',
    };
    // @ts-ignore - renotify is supported in most browsers but not in TS types
    options.renotify = true;
    const notification = new Notification(title, options);

    if (link) {
      notification.onclick = () => {
        window.focus();
        window.location.href = link;
        notification.close();
      };
    }

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000);
  } catch (e) {
    console.warn('Could not show push notification:', e);
  }
}

export function useNotificationAlert() {
  const { user } = useAuth();
  const [hasUnreadActions, setHasUnreadActions] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteractedRef = useRef(false);

  // Track user interaction (required for Audio API)
  useEffect(() => {
    const handleInteraction = () => {
      userInteractedRef.current = true;
    };
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  // Request push permission on mount
  useEffect(() => {
    requestPushPermission().then(setPushEnabled);
  }, []);

  // Start/stop persistent sound based on unread actions
  const startPersistentSound = useCallback(() => {
    if (soundIntervalRef.current) return;

    // Play immediately
    if (userInteractedRef.current) {
      playNotificationBeep();
    }

    // Then repeat every SOUND_REPEAT_INTERVAL
    soundIntervalRef.current = setInterval(() => {
      if (userInteractedRef.current && document.visibilityState !== 'hidden') {
        playNotificationBeep();
      }
    }, SOUND_REPEAT_INTERVAL);
  }, []);

  const stopPersistentSound = useCallback(() => {
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
  }, []);

  // Check for unread notifications requiring action
  const checkUnreadActions = useCallback(async () => {
    if (!user) return;

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    const hasUnread = (count || 0) > 0;
    setHasUnreadActions(hasUnread);

    if (hasUnread) {
      startPersistentSound();
    } else {
      stopPersistentSound();
    }
  }, [user, startPersistentSound, stopPersistentSound]);

  // Listen for new notifications in realtime
  useEffect(() => {
    if (!user) return;

    checkUnreadActions();

    const channel = supabase
      .channel('notification-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as any;

          // Play immediate sound
          if (userInteractedRef.current) {
            playNotificationBeep();
          }

          // Show browser push notification
          if (pushEnabled) {
            showPushNotification(
              notification.title || 'Nouvelle notification',
              notification.message || '',
              notification.link
            );
          }

          // Start persistent sound
          setHasUnreadActions(true);
          startPersistentSound();
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
          // Re-check if all notifications are read
          checkUnreadActions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopPersistentSound();
    };
  }, [user, pushEnabled, checkUnreadActions, startPersistentSound, stopPersistentSound]);

  // Stop sound when page becomes hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Keep running but skip actual sound playback (handled in interval)
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return {
    hasUnreadActions,
    pushEnabled,
    stopSound: stopPersistentSound,
    requestPush: () => requestPushPermission().then(setPushEnabled),
  };
}
