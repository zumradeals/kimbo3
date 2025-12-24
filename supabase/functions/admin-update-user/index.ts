import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateUserRequest {
  user_id: string;
  email?: string;
  password?: string;
  reason: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !caller) {
      throw new Error("Invalid token");
    }

    // Check if caller is admin
    const { data: isAdminData } = await supabaseAdmin.rpc("is_admin", { _user_id: caller.id });
    
    if (!isAdminData) {
      throw new Error("Only admins can update users");
    }

    const { user_id, email, password, reason }: UpdateUserRequest = await req.json();

    // Validate input
    if (!user_id) {
      throw new Error("User ID is required");
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error("A reason is required (min 5 characters)");
    }

    if (!email && !password) {
      throw new Error("Email or password must be provided");
    }

    // Prevent admin from modifying themselves for email
    if (email && user_id === caller.id) {
      throw new Error("Cannot modify your own email");
    }

    // Prepare update object
    const updateData: { email?: string; password?: string } = {};
    if (email) updateData.email = email;
    if (password) {
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }
      updateData.password = password;
    }

    // Update user with admin API
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      updateData
    );

    if (updateError) {
      throw updateError;
    }

    // Update email in profiles table if email was changed
    if (email) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ email })
        .eq("id", user_id);

      if (profileError) {
        console.error("Error updating profile email:", profileError);
      }
    }

    // Log the action in audit_logs
    await supabaseAdmin.from("audit_logs").insert({
      user_id: caller.id,
      action: email && password ? 'ADMIN_UPDATE_EMAIL_PASSWORD' : email ? 'ADMIN_UPDATE_EMAIL' : 'ADMIN_RESET_PASSWORD',
      table_name: 'auth.users',
      record_id: user_id,
      new_values: { 
        reason,
        email_changed: !!email,
        password_reset: !!password,
      },
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
    console.error("Error updating user:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
