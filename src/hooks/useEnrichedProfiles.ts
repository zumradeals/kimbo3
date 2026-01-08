import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EnrichedProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  photo_url: string | null;
  fonction: string | null;
  department_name: string | null;
}

// Cache for profiles to avoid repeated fetches
const profileCache = new Map<string, EnrichedProfile>();

export function useEnrichedProfiles(userIds: (string | null | undefined)[]) {
  const [profiles, setProfiles] = useState<Map<string, EnrichedProfile>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfiles = useCallback(async () => {
    // Filter out null/undefined and already cached
    const idsToFetch = [...new Set(
      userIds.filter((id): id is string => 
        id != null && !profileCache.has(id)
      )
    )];

    if (idsToFetch.length === 0) {
      // Return cached values
      const cached = new Map<string, EnrichedProfile>();
      userIds.forEach(id => {
        if (id && profileCache.has(id)) {
          cached.set(id, profileCache.get(id)!);
        }
      });
      setProfiles(cached);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, photo_url, fonction, department:departments(name)')
        .in('id', idsToFetch);

      if (error) throw error;

      const newProfiles = new Map<string, EnrichedProfile>(profiles);
      
      data?.forEach(profile => {
        const enriched: EnrichedProfile = {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          photo_url: profile.photo_url,
          fonction: profile.fonction,
          department_name: (profile.department as any)?.name || null,
        };
        newProfiles.set(profile.id, enriched);
        profileCache.set(profile.id, enriched);
      });

      // Add already cached profiles
      userIds.forEach(id => {
        if (id && profileCache.has(id) && !newProfiles.has(id)) {
          newProfiles.set(id, profileCache.get(id)!);
        }
      });

      setProfiles(newProfiles);
    } catch (error) {
      console.error('Error fetching enriched profiles:', error);
    } finally {
      setIsLoading(false);
    }
  }, [JSON.stringify(userIds)]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const getProfile = useCallback((userId: string | null | undefined): EnrichedProfile | null => {
    if (!userId) return null;
    return profiles.get(userId) || profileCache.get(userId) || null;
  }, [profiles]);

  return { profiles, getProfile, isLoading };
}

// Helper to build timeline events from document data
export function buildTimelineFromDocument(
  doc: Record<string, any>,
  getProfile: (id: string | null | undefined) => EnrichedProfile | null,
  type: 'besoin' | 'da' | 'bl' | 'note_frais'
) {
  const events: Array<{
    id: string;
    action: string;
    actionLabel: string;
    timestamp: string;
    user?: {
      id?: string;
      photoUrl?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      fonction?: string | null;
      departmentName?: string | null;
    };
    comment?: string | null;
    variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  }> = [];

  // Created
  if (doc.created_at) {
    const creator = getProfile(doc.user_id || doc.created_by);
    events.push({
      id: 'created',
      action: 'created',
      actionLabel: type === 'besoin' ? 'Besoin créé' : 
                   type === 'da' ? 'Demande d\'achat créée' :
                   type === 'bl' ? 'Bon de livraison créé' : 'Note de frais créée',
      timestamp: doc.created_at,
      user: creator ? {
        id: creator.id,
        photoUrl: creator.photo_url,
        firstName: creator.first_name,
        lastName: creator.last_name,
        fonction: creator.fonction,
        departmentName: creator.department_name,
      } : undefined,
      variant: 'info',
    });
  }

  // Submitted
  if (doc.submitted_at) {
    const submitter = getProfile(doc.submitted_validation_by || doc.user_id || doc.created_by);
    events.push({
      id: 'submitted',
      action: 'submitted',
      actionLabel: 'Soumis pour traitement',
      timestamp: doc.submitted_at,
      user: submitter ? {
        id: submitter.id,
        photoUrl: submitter.photo_url,
        firstName: submitter.first_name,
        lastName: submitter.last_name,
        fonction: submitter.fonction,
        departmentName: submitter.department_name,
      } : undefined,
      variant: 'info',
    });
  }

  // Taken (besoin)
  if (doc.taken_at && doc.taken_by) {
    const taker = getProfile(doc.taken_by);
    events.push({
      id: 'taken',
      action: 'taken',
      actionLabel: 'Pris en charge par la Logistique',
      timestamp: doc.taken_at,
      user: taker ? {
        id: taker.id,
        photoUrl: taker.photo_url,
        firstName: taker.first_name,
        lastName: taker.last_name,
        fonction: taker.fonction,
        departmentName: taker.department_name,
      } : undefined,
      variant: 'warning',
    });
  }

  // Analyzed
  if (doc.analyzed_at && doc.analyzed_by) {
    const analyzer = getProfile(doc.analyzed_by);
    events.push({
      id: 'analyzed',
      action: 'analyzed',
      actionLabel: 'Analysé par les Achats',
      timestamp: doc.analyzed_at,
      user: analyzer ? {
        id: analyzer.id,
        photoUrl: analyzer.photo_url,
        firstName: analyzer.first_name,
        lastName: analyzer.last_name,
        fonction: analyzer.fonction,
        departmentName: analyzer.department_name,
      } : undefined,
      variant: 'info',
    });
  }

  // Priced
  if (doc.priced_at && doc.priced_by) {
    const pricer = getProfile(doc.priced_by);
    events.push({
      id: 'priced',
      action: 'priced',
      actionLabel: 'Chiffré par les Achats',
      timestamp: doc.priced_at,
      user: pricer ? {
        id: pricer.id,
        photoUrl: pricer.photo_url,
        firstName: pricer.first_name,
        lastName: pricer.last_name,
        fonction: pricer.fonction,
        departmentName: pricer.department_name,
      } : undefined,
      variant: 'info',
    });
  }

  // Submitted for validation
  if (doc.submitted_validation_at && doc.submitted_validation_by) {
    const submitter = getProfile(doc.submitted_validation_by);
    events.push({
      id: 'submitted_validation',
      action: 'submitted',
      actionLabel: 'Soumis pour validation financière',
      timestamp: doc.submitted_validation_at,
      user: submitter ? {
        id: submitter.id,
        photoUrl: submitter.photo_url,
        firstName: submitter.first_name,
        lastName: submitter.last_name,
        fonction: submitter.fonction,
        departmentName: submitter.department_name,
      } : undefined,
      variant: 'info',
    });
  }

  // Validated finance
  if (doc.validated_finance_at && doc.validated_finance_by) {
    const validator = getProfile(doc.validated_finance_by);
    events.push({
      id: 'validated_finance',
      action: 'validated',
      actionLabel: 'Validé financièrement',
      timestamp: doc.validated_finance_at,
      user: validator ? {
        id: validator.id,
        photoUrl: validator.photo_url,
        firstName: validator.first_name,
        lastName: validator.last_name,
        fonction: validator.fonction,
        departmentName: validator.department_name,
      } : undefined,
      comment: doc.finance_decision_comment,
      variant: 'success',
    });
  }

  // Validated DAF (notes frais)
  if (doc.validated_daf_at && doc.validated_daf_by) {
    const validator = getProfile(doc.validated_daf_by);
    events.push({
      id: 'validated_daf',
      action: 'validated',
      actionLabel: 'Validé par le DAF',
      timestamp: doc.validated_daf_at,
      user: validator ? {
        id: validator.id,
        photoUrl: validator.photo_url,
        firstName: validator.first_name,
        lastName: validator.last_name,
        fonction: validator.fonction,
        departmentName: validator.department_name,
      } : undefined,
      variant: 'success',
    });
  }

  // Validated BL
  if (doc.validated_at && doc.validated_by) {
    const validator = getProfile(doc.validated_by);
    events.push({
      id: 'validated',
      action: 'validated',
      actionLabel: 'Validé',
      timestamp: doc.validated_at,
      user: validator ? {
        id: validator.id,
        photoUrl: validator.photo_url,
        firstName: validator.first_name,
        lastName: validator.last_name,
        fonction: validator.fonction,
        departmentName: validator.department_name,
      } : undefined,
      variant: 'success',
    });
  }

  // Decided (besoin - accepte/refuse)
  if (doc.decided_at && doc.decided_by) {
    const decider = getProfile(doc.decided_by);
    const isAccepted = doc.status === 'accepte';
    const isReturned = doc.status === 'retourne';
    events.push({
      id: 'decided',
      action: isAccepted ? 'accepted' : isReturned ? 'returned' : 'rejected',
      actionLabel: isAccepted ? 'Accepté pour transformation' : 
                   isReturned ? 'Retourné pour correction' : 'Refusé',
      timestamp: doc.decided_at,
      user: decider ? {
        id: decider.id,
        photoUrl: decider.photo_url,
        firstName: decider.first_name,
        lastName: decider.last_name,
        fonction: decider.fonction,
        departmentName: decider.department_name,
      } : undefined,
      comment: doc.rejection_reason || doc.return_comment,
      variant: isAccepted ? 'success' : isReturned ? 'warning' : 'destructive',
    });
  }

  // Rejected
  if (doc.rejected_at && doc.rejected_by) {
    const rejector = getProfile(doc.rejected_by);
    events.push({
      id: 'rejected',
      action: 'rejected',
      actionLabel: 'Rejeté',
      timestamp: doc.rejected_at,
      user: rejector ? {
        id: rejector.id,
        photoUrl: rejector.photo_url,
        firstName: rejector.first_name,
        lastName: rejector.last_name,
        fonction: rejector.fonction,
        departmentName: rejector.department_name,
      } : undefined,
      comment: doc.rejection_reason,
      variant: 'destructive',
    });
  }

  // Comptabilisé
  if (doc.comptabilise_at && doc.comptabilise_by) {
    const comptable = getProfile(doc.comptabilise_by);
    events.push({
      id: 'comptabilise',
      action: 'validated',
      actionLabel: 'Traité par la comptabilité',
      timestamp: doc.comptabilise_at,
      user: comptable ? {
        id: comptable.id,
        photoUrl: comptable.photo_url,
        firstName: comptable.first_name,
        lastName: comptable.last_name,
        fonction: comptable.fonction,
        departmentName: comptable.department_name,
      } : undefined,
      variant: 'success',
    });
  }

  // Paid
  if (doc.paid_at && doc.paid_by) {
    const payer = getProfile(doc.paid_by);
    events.push({
      id: 'paid',
      action: 'paid',
      actionLabel: 'Payé',
      timestamp: doc.paid_at,
      user: payer ? {
        id: payer.id,
        photoUrl: payer.photo_url,
        firstName: payer.first_name,
        lastName: payer.last_name,
        fonction: payer.fonction,
        departmentName: payer.department_name,
      } : undefined,
      variant: 'success',
    });
  }

  // Delivered
  if (doc.delivered_at && doc.delivered_by) {
    const deliverer = getProfile(doc.delivered_by);
    events.push({
      id: 'delivered',
      action: 'validated',
      actionLabel: 'Livré',
      timestamp: doc.delivered_at,
      user: deliverer ? {
        id: deliverer.id,
        photoUrl: deliverer.photo_url,
        firstName: deliverer.first_name,
        lastName: deliverer.last_name,
        fonction: deliverer.fonction,
        departmentName: deliverer.department_name,
      } : undefined,
      variant: 'success',
    });
  }

  // Locked
  if (doc.locked_at && doc.is_locked) {
    events.push({
      id: 'locked',
      action: 'locked',
      actionLabel: 'Verrouillé',
      timestamp: doc.locked_at,
      comment: doc.locked_reason,
      variant: 'warning',
    });
  }

  // Cancelled
  if (doc.cancelled_at && doc.cancelled_by) {
    const canceller = getProfile(doc.cancelled_by);
    events.push({
      id: 'cancelled',
      action: 'cancelled',
      actionLabel: 'Annulé',
      timestamp: doc.cancelled_at,
      user: canceller ? {
        id: canceller.id,
        photoUrl: canceller.photo_url,
        firstName: canceller.first_name,
        lastName: canceller.last_name,
        fonction: canceller.fonction,
        departmentName: canceller.department_name,
      } : undefined,
      comment: doc.cancellation_reason,
      variant: 'destructive',
    });
  }

  // Sort by timestamp descending (most recent first)
  return events.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
