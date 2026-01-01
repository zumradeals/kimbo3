/**
 * Rate Limiter pour Edge Functions KPM
 * Implémente un rate limiting en mémoire par IP/user
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// Store en mémoire (par instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

/**
 * Vérifie et applique le rate limit
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  
  // Nettoyer les entrées expirées périodiquement
  if (Math.random() < 0.1) {
    cleanupExpiredEntries(now);
  }
  
  const entry = rateLimitStore.get(key);
  
  if (!entry || now >= entry.resetTime) {
    // Nouvelle fenêtre
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs
    };
  }
  
  // Fenêtre existante
  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetTime - now
    };
  }
  
  entry.count++;
  rateLimitStore.set(key, entry);
  
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now
  };
}

function cleanupExpiredEntries(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now >= entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Génère l'identifiant pour le rate limit
 */
export function getRateLimitIdentifier(req: Request, userId?: string): string {
  // Priorité: user_id > IP
  if (userId) {
    return `user:${userId}`;
  }
  
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || 
             req.headers.get("x-real-ip") || 
             "unknown";
  return `ip:${ip}`;
}

/**
 * Crée une réponse 429 Too Many Requests
 */
export function rateLimitResponse(resetIn: number, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: "Trop de requêtes. Veuillez réessayer plus tard.",
      retry_after_ms: resetIn
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(Math.ceil(resetIn / 1000))
      }
    }
  );
}
