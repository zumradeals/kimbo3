/**
 * Edge Function: delete-user
 * Supprime un utilisateur (admin uniquement)
 * 
 * SÉCURITÉ:
 * - Rate limiting: 10 requêtes/minute par IP/utilisateur
 * - Logging structuré complet
 * - Vérification admin requise
 * - Auto-suppression interdite
 * 
 * Pour déployer sur Supabase self-hosted:
 * supabase functions deploy delete-user
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= Rate Limiting =============
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60000;

function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);
  
  if (!entry || now >= entry.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now };
  }
  
  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count, resetIn: entry.resetTime - now };
}

function getRateLimitId(req: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
             req.headers.get("x-real-ip") || "unknown";
  return `ip:${ip}`;
}

// ============= Structured Logging =============
interface LogEntry {
  timestamp: string;
  function: string;
  action: string;
  caller_id?: string;
  target_id?: string;
  result: "success" | "failure" | "blocked";
  duration_ms: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

function log(startTime: number, entry: Partial<LogEntry>): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    function: "delete-user",
    action: entry.action || "unknown",
    result: entry.result || "success",
    duration_ms: Date.now() - startTime,
    ...entry
  };
  
  if (entry.result === "failure") {
    console.error(JSON.stringify(logEntry));
  } else if (entry.result === "blocked") {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const rateLimitId = getRateLimitId(req);
  const rateCheck = checkRateLimit(rateLimitId);
  
  if (!rateCheck.allowed) {
    log(startTime, {
      action: "rate_limit_exceeded",
      result: "blocked",
      metadata: { identifier: rateLimitId, reset_in_ms: rateCheck.resetIn }
    });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: "Trop de requêtes. Veuillez réessayer plus tard.",
        retry_after_ms: rateCheck.resetIn 
      }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil(rateCheck.resetIn / 1000))
        } 
      }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      log(startTime, { action: "auth_missing", result: "failure", error: "No authorization header" });
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      log(startTime, { action: "auth_invalid", result: "failure", error: "Invalid token" });
      throw new Error("Invalid token");
    }

    // Check if caller is admin
    const { data: isAdminData } = await supabaseAdmin.rpc("is_admin", { _user_id: caller.id });
    
    if (!isAdminData) {
      log(startTime, { 
        action: "permission_denied", 
        result: "blocked", 
        caller_id: caller.id,
        error: "Only admins can delete users" 
      });
      throw new Error("Only admins can delete users");
    }

    const { user_id } = await req.json();

    if (!user_id) {
      log(startTime, { 
        action: "validation_failed", 
        result: "failure", 
        caller_id: caller.id,
        error: "User ID is required" 
      });
      throw new Error("User ID is required");
    }

    // Prevent self-deletion
    if (user_id === caller.id) {
      log(startTime, { 
        action: "self_delete_blocked", 
        result: "blocked", 
        caller_id: caller.id,
        target_id: user_id,
        error: "Cannot delete own account" 
      });
      throw new Error("You cannot delete your own account");
    }

    // Get target user info for logging
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", user_id)
      .single();

    // Delete user with admin API (this will cascade to profiles and user_roles)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (deleteError) {
      log(startTime, { 
        action: "delete_failed", 
        result: "failure", 
        caller_id: caller.id,
        target_id: user_id,
        error: deleteError.message 
      });
      throw deleteError;
    }

    log(startTime, { 
      action: "user_deleted", 
      result: "success", 
      caller_id: caller.id,
      target_id: user_id,
      metadata: { 
        deleted_email: targetProfile?.email,
        deleted_name: `${targetProfile?.first_name} ${targetProfile?.last_name}`
      }
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    log(startTime, { 
      action: "delete_user_error", 
      result: "failure", 
      error: error.message 
    });
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
