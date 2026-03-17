import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const SOUND_REPEAT_INTERVAL = 20000;
const NOTIFICATION_SOUND_FREQUENCY = 800;
const NOTIFICATION_SOUND_DURATION = 150;

const MUTE_STORAGE_KEY = 'kpm_notification_sound_muted';

export function getNotificationSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setNotificationSoundMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('kpm-sound-mute-change', { detail: { muted } }));
  } catch {
    // ignore
  }
}

function playNotificationBeep() {
  if (getNotificationSoundMuted()) return;
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
    playBeep(now, NOTIFICATION_SOUND_FREQUENCY, NOTIFICATION_SOUND_DURATION);
    playBeep(now + 0.2, NOTIFICATION_SOUND_FREQUENCY + 100, NOTIFICATION_SOUND_DURATION);
    playBeep(now + 0.4, NOTIFICATION_SOUND_FREQUENCY + 200, NOTIFICATION_SOUND_DURATION);
    setTimeout(() => audioContext.close(), 2000);
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
}

async function requestPushPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function showPushNotification(title: string, body: string, link?: string | null) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const options: NotificationOptions & { renotify?: boolean } = {
      body,
      icon: '/logo-kimbo.png',
      badge: '/logo-kimbo.png',
      tag: 'kpm-notification',
    };
    options.renotify = true;
    const notification = new Notification(title, options);
    if (link) {
      notification.onclick = () => {
        window.focus();
        window.location.href = link;
        notification.close();
      };
    }
    setTimeout(() => notification.close(), 8000);
  } catch (e) {
    console.warn('Could not show push notification:', e);
  }
}

export function useNotificationAlert() {
  const { user } = useAuth();
  const [hasUnreadActions, setHasUnreadActions] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(getNotificationSoundMuted);
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteractedRef = useRef(false);

  // Sync mute state across tabs/components
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setIsMuted(detail.muted);
    };
    window.addEventListener('kpm-sound-mute-change', handler);
    return () => window.removeEventListener('kpm-sound-mute-change', handler);
  }, []);

  // Track user interaction
  useEffect(() => {
    const handleInteraction = () => { userInteractedRef.current = true; };
    window.addEventListener('click', handleInteraction, { once: true });
    window.addEventListener('keydown', handleInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, []);

  useEffect(() => {
    requestPushPermission().then(setPushEnabled);
  }, []);

  const startPersistentSound = useCallback(() => {
    if (soundIntervalRef.current) return;
    if (userInteractedRef.current) playNotificationBeep();
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

  // Stop persistent sound when muted
  useEffect(() => {
    if (isMuted) {
      stopPersistentSound();
    } else if (hasUnreadActions) {
      startPersistentSound();
    }
  }, [isMuted, hasUnreadActions, startPersistentSound, stopPersistentSound]);

  const checkUnreadActions = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    const hasUnread = (count || 0) > 0;
    setHasUnreadActions(hasUnread);

    if (hasUnread && !getNotificationSoundMuted()) {
      startPersistentSound();
    } else {
      stopPersistentSound();
    }
  }, [user, startPersistentSound, stopPersistentSound]);

  useEffect(() => {
    if (!user) return;
    checkUnreadActions();

    const channel = supabase
      .channel('notification-alerts')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const notification = payload.new as any;
        if (userInteractedRef.current) playNotificationBeep();
        if (pushEnabled) {
          showPushNotification(
            notification.title || 'Nouvelle notification',
            notification.message || '',
            notification.link
          );
        }
        setHasUnreadActions(true);
        if (!getNotificationSoundMuted()) startPersistentSound();
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { checkUnreadActions(); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      stopPersistentSound();
    };
  }, [user, pushEnabled, checkUnreadActions, startPersistentSound, stopPersistentSound]);

  useEffect(() => {
    const handleVisibilityChange = () => {};
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return {
    hasUnreadActions,
    pushEnabled,
    isMuted,
    stopSound: stopPersistentSound,
    requestPush: () => requestPushPermission().then(setPushEnabled),
    toggleMute: () => {
      const newMuted = !isMuted;
      setNotificationSoundMuted(newMuted);
      setIsMuted(newMuted);
      if (newMuted) stopPersistentSound();
    },
  };
}
