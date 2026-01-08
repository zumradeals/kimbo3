import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  department_id?: string;
  roles?: string[];
  role?: string; // backward compatibility
  fonction?: string;
  chef_hierarchique_id?: string;
  position_departement?: string;
  statut_utilisateur?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client
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
      throw new Error("Only admins can create users");
    }

    const { 
      email, password, first_name, last_name, department_id, roles, role,
      fonction, chef_hierarchique_id, position_departement, statut_utilisateur 
    }: CreateUserRequest = await req.json();

    // Support both single role (backward compat) and multiple roles
    const userRoles: string[] = roles && roles.length > 0 ? roles : (role ? [role] : ['employe']);

    // Validate input
    if (!email || !password || !first_name || !last_name) {
      throw new Error("Missing required fields");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // Create user with admin API
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        first_name,
        last_name,
      },
    });

    if (createError) {
      throw createError;
    }

    if (!newUser.user) {
      throw new Error("Failed to create user");
    }

    // Update profile with all provided fields
    const profileUpdate: Record<string, unknown> = {};
    if (department_id) profileUpdate.department_id = department_id;
    if (fonction) profileUpdate.fonction = fonction;
    if (chef_hierarchique_id) profileUpdate.chef_hierarchique_id = chef_hierarchique_id;
    if (position_departement) profileUpdate.position_departement = position_departement;
    if (statut_utilisateur) profileUpdate.statut_utilisateur = statut_utilisateur;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdate)
        .eq("id", newUser.user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }
    }

    // Update roles (the trigger creates default 'employe' role, so we update)
    // Delete the default role first
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", newUser.user.id);

    // Insert all specified roles
    const rolesToInsert = userRoles.map(r => ({
      user_id: newUser.user.id,
      role: r,
      assigned_by: caller.id,
    }));

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert(rolesToInsert);

    if (roleError) {
      console.error("Error setting roles:", roleError);
    }

    return new Response(
      JSON.stringify({ success: true, user: { id: newUser.user.id, email: newUser.user.email } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
