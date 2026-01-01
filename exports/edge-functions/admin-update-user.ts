/**
 * Edge Function: admin-update-user
 * Met à jour email/password d'un utilisateur (admin uniquement)
 * 
 * SÉCURITÉ:
 * - Rate limiting: 10 requêtes/minute par IP/utilisateur
 * - Logging structuré complet
 * - Vérification admin requise
 * - Justification obligatoire
 * - Audit trail via audit_logs
 * 
 * Pour déployer sur Supabase self-hosted:
 * supabase functions deploy admin-update-user
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
    function: "admin-update-user",
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

// ============= Types =============
interface UpdateUserRequest {
  user_id: string;
  email?: string;
  password?: string;
  reason: string;
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
        error: "Only admins can update users" 
      });
      throw new Error("Only admins can update users");
    }

    const { user_id, email, password, reason }: UpdateUserRequest = await req.json();

    // Validate input
    if (!user_id) {
      log(startTime, { 
        action: "validation_failed", 
        result: "failure", 
        caller_id: caller.id,
        error: "User ID is required" 
      });
      throw new Error("User ID is required");
    }

    if (!reason || reason.trim().length < 5) {
      log(startTime, { 
        action: "validation_failed", 
        result: "failure", 
        caller_id: caller.id,
        target_id: user_id,
        error: "Reason required (min 5 chars)" 
      });
      throw new Error("A reason is required (min 5 characters)");
    }

    if (!email && !password) {
      log(startTime, { 
        action: "validation_failed", 
        result: "failure", 
        caller_id: caller.id,
        target_id: user_id,
        error: "Email or password must be provided" 
      });
      throw new Error("Email or password must be provided");
    }

    // Prevent admin from modifying themselves for email
    if (email && user_id === caller.id) {
      log(startTime, { 
        action: "self_modify_blocked", 
        result: "blocked", 
        caller_id: caller.id,
        target_id: user_id,
        error: "Cannot modify own email" 
      });
      throw new Error("Cannot modify your own email");
    }

    // Prepare update object
    const updateData: { email?: string; password?: string } = {};
    if (email) updateData.email = email;
    if (password) {
      if (password.length < 6) {
        log(startTime, { 
          action: "validation_failed", 
          result: "failure", 
          caller_id: caller.id,
          target_id: user_id,
          error: "Password too short" 
        });
        throw new Error("Password must be at least 6 characters");
      }
      updateData.password = password;
    }

    // Get old email for audit
    const { data: oldProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", user_id)
      .single();

    // Update user with admin API
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      updateData
    );

    if (updateError) {
      log(startTime, { 
        action: "update_failed", 
        result: "failure", 
        caller_id: caller.id,
        target_id: user_id,
        error: updateError.message 
      });
      throw updateError;
    }

    // Update email in profiles table if email was changed
    if (email) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ email })
        .eq("id", user_id);

      if (profileError) {
        log(startTime, { 
          action: "profile_update_failed", 
          result: "failure", 
          caller_id: caller.id,
          target_id: user_id,
          error: profileError.message 
        });
        console.error("Error updating profile email:", profileError);
      }
    }

    // Log the action in audit_logs
    const actionType = email && password ? 'ADMIN_UPDATE_EMAIL_PASSWORD' : 
                       email ? 'ADMIN_UPDATE_EMAIL' : 'ADMIN_RESET_PASSWORD';
    
    await supabaseAdmin.from("audit_logs").insert({
      user_id: caller.id,
      action: actionType,
      table_name: 'auth.users',
      record_id: user_id,
      old_values: email ? { email: oldProfile?.email } : null,
      new_values: { 
        reason,
        email_changed: !!email,
        password_reset: !!password,
        new_email: email || undefined,
      },
    });

    log(startTime, { 
      action: actionType.toLowerCase(), 
      result: "success", 
      caller_id: caller.id,
      target_id: user_id,
      metadata: { 
        email_changed: !!email, 
        password_reset: !!password,
        reason 
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: updatedUser.user.id, 
          email: updatedUser.user.email 
        } 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    log(startTime, { 
      action: "update_user_error", 
      result: "failure", 
      error: error.message 
    });
    
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
