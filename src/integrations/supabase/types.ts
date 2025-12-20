export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      besoins: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          category: Database["public"]["Enums"]["besoin_category"]
          created_at: string
          decided_at: string | null
          decided_by: string | null
          department_id: string
          description: string
          desired_date: string | null
          id: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["besoin_status"]
          taken_at: string | null
          taken_by: string | null
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["besoin_urgency"]
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          category: Database["public"]["Enums"]["besoin_category"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          department_id: string
          description: string
          desired_date?: string | null
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["besoin_status"]
          taken_at?: string | null
          taken_by?: string | null
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["besoin_urgency"]
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          category?: Database["public"]["Enums"]["besoin_category"]
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          department_id?: string
          description?: string
          desired_date?: string | null
          id?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["besoin_status"]
          taken_at?: string | null
          taken_by?: string | null
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["besoin_urgency"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "besoins_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "besoins_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "besoins_taken_by_fkey"
            columns: ["taken_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "besoins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bl_articles: {
        Row: {
          bl_id: string
          created_at: string
          designation: string
          id: string
          observations: string | null
          quantity: number
          unit: string
        }
        Insert: {
          bl_id: string
          created_at?: string
          designation: string
          id?: string
          observations?: string | null
          quantity: number
          unit?: string
        }
        Update: {
          bl_id?: string
          created_at?: string
          designation?: string
          id?: string
          observations?: string | null
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "bl_articles_bl_id_fkey"
            columns: ["bl_id"]
            isOneToOne: false
            referencedRelation: "bons_livraison"
            referencedColumns: ["id"]
          },
        ]
      }
      bons_livraison: {
        Row: {
          besoin_id: string
          created_at: string
          created_by: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_date: string | null
          department_id: string
          id: string
          observations: string | null
          reference: string
          status: Database["public"]["Enums"]["bl_status"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          warehouse: string | null
        }
        Insert: {
          besoin_id: string
          created_at?: string
          created_by: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          department_id: string
          id?: string
          observations?: string | null
          reference: string
          status?: Database["public"]["Enums"]["bl_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          warehouse?: string | null
        }
        Update: {
          besoin_id?: string
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          department_id?: string
          id?: string
          observations?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["bl_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          warehouse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bons_livraison_besoin_id_fkey"
            columns: ["besoin_id"]
            isOneToOne: false
            referencedRelation: "besoins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      da_article_prices: {
        Row: {
          conditions: string | null
          created_at: string
          created_by: string | null
          currency: string
          da_article_id: string
          delivery_delay: string | null
          fournisseur_id: string
          id: string
          is_selected: boolean
          unit_price: number
        }
        Insert: {
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          da_article_id: string
          delivery_delay?: string | null
          fournisseur_id: string
          id?: string
          is_selected?: boolean
          unit_price: number
        }
        Update: {
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          da_article_id?: string
          delivery_delay?: string | null
          fournisseur_id?: string
          id?: string
          is_selected?: boolean
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "da_article_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "da_article_prices_da_article_id_fkey"
            columns: ["da_article_id"]
            isOneToOne: false
            referencedRelation: "da_articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "da_article_prices_fournisseur_id_fkey"
            columns: ["fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
        ]
      }
      da_articles: {
        Row: {
          created_at: string
          da_id: string
          designation: string
          id: string
          observations: string | null
          quantity: number
          unit: string
        }
        Insert: {
          created_at?: string
          da_id: string
          designation: string
          id?: string
          observations?: string | null
          quantity: number
          unit?: string
        }
        Update: {
          created_at?: string
          da_id?: string
          designation?: string
          id?: string
          observations?: string | null
          quantity?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "da_articles_da_id_fkey"
            columns: ["da_id"]
            isOneToOne: false
            referencedRelation: "demandes_achat"
            referencedColumns: ["id"]
          },
        ]
      }
      demandes_achat: {
        Row: {
          analyzed_at: string | null
          analyzed_by: string | null
          besoin_id: string
          category: Database["public"]["Enums"]["da_category"]
          created_at: string
          created_by: string
          currency: string | null
          department_id: string
          description: string
          desired_date: string | null
          finance_decision_comment: string | null
          fournisseur_justification: string | null
          id: string
          observations: string | null
          priced_at: string | null
          priced_by: string | null
          priority: Database["public"]["Enums"]["da_priority"]
          reference: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          revision_comment: string | null
          revision_requested_at: string | null
          revision_requested_by: string | null
          selected_fournisseur_id: string | null
          status: Database["public"]["Enums"]["da_status"]
          submitted_at: string | null
          submitted_validation_at: string | null
          submitted_validation_by: string | null
          total_amount: number | null
          updated_at: string
          validated_finance_at: string | null
          validated_finance_by: string | null
        }
        Insert: {
          analyzed_at?: string | null
          analyzed_by?: string | null
          besoin_id: string
          category: Database["public"]["Enums"]["da_category"]
          created_at?: string
          created_by: string
          currency?: string | null
          department_id: string
          description: string
          desired_date?: string | null
          finance_decision_comment?: string | null
          fournisseur_justification?: string | null
          id?: string
          observations?: string | null
          priced_at?: string | null
          priced_by?: string | null
          priority?: Database["public"]["Enums"]["da_priority"]
          reference: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          revision_comment?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          selected_fournisseur_id?: string | null
          status?: Database["public"]["Enums"]["da_status"]
          submitted_at?: string | null
          submitted_validation_at?: string | null
          submitted_validation_by?: string | null
          total_amount?: number | null
          updated_at?: string
          validated_finance_at?: string | null
          validated_finance_by?: string | null
        }
        Update: {
          analyzed_at?: string | null
          analyzed_by?: string | null
          besoin_id?: string
          category?: Database["public"]["Enums"]["da_category"]
          created_at?: string
          created_by?: string
          currency?: string | null
          department_id?: string
          description?: string
          desired_date?: string | null
          finance_decision_comment?: string | null
          fournisseur_justification?: string | null
          id?: string
          observations?: string | null
          priced_at?: string | null
          priced_by?: string | null
          priority?: Database["public"]["Enums"]["da_priority"]
          reference?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          revision_comment?: string | null
          revision_requested_at?: string | null
          revision_requested_by?: string | null
          selected_fournisseur_id?: string | null
          status?: Database["public"]["Enums"]["da_status"]
          submitted_at?: string | null
          submitted_validation_at?: string | null
          submitted_validation_by?: string | null
          total_amount?: number | null
          updated_at?: string
          validated_finance_at?: string | null
          validated_finance_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demandes_achat_analyzed_by_fkey"
            columns: ["analyzed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_besoin_id_fkey"
            columns: ["besoin_id"]
            isOneToOne: false
            referencedRelation: "besoins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_priced_by_fkey"
            columns: ["priced_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_revision_requested_by_fkey"
            columns: ["revision_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_selected_fournisseur_id_fkey"
            columns: ["selected_fournisseur_id"]
            isOneToOne: false
            referencedRelation: "fournisseurs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_submitted_validation_by_fkey"
            columns: ["submitted_validation_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_validated_finance_by_fkey"
            columns: ["validated_finance_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fournisseurs: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fournisseurs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          module: string | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          module?: string | null
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department_id: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          category?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_besoin: { Args: { _user_id: string }; Returns: boolean }
      can_transform_besoin: { Args: { _besoin_id: string }; Returns: boolean }
      create_notification: {
        Args: {
          _link?: string
          _message: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      generate_bl_reference: { Args: never; Returns: string }
      generate_da_reference: { Args: never; Returns: string }
      get_user_department: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_achats: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_dg: { Args: { _user_id: string }; Returns: boolean }
      is_logistics: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "dg"
        | "daf"
        | "comptable"
        | "responsable_logistique"
        | "agent_logistique"
        | "responsable_achats"
        | "agent_achats"
        | "responsable_departement"
        | "employe"
        | "lecture_seule"
      besoin_category:
        | "materiel"
        | "service"
        | "maintenance"
        | "urgence"
        | "autre"
      besoin_status: "cree" | "pris_en_charge" | "accepte" | "refuse"
      besoin_urgency: "normale" | "urgente" | "critique"
      bl_status: "prepare" | "en_attente_validation" | "valide" | "livre"
      da_category:
        | "fournitures"
        | "equipement"
        | "service"
        | "maintenance"
        | "informatique"
        | "autre"
      da_priority: "basse" | "normale" | "haute" | "urgente"
      da_status:
        | "brouillon"
        | "soumise"
        | "rejetee"
        | "en_analyse"
        | "chiffree"
        | "soumise_validation"
        | "validee_finance"
        | "refusee_finance"
        | "en_revision_achats"
        | "payee"
        | "rejetee_comptabilite"
      user_status: "active" | "inactive" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "dg",
        "daf",
        "comptable",
        "responsable_logistique",
        "agent_logistique",
        "responsable_achats",
        "agent_achats",
        "responsable_departement",
        "employe",
        "lecture_seule",
      ],
      besoin_category: [
        "materiel",
        "service",
        "maintenance",
        "urgence",
        "autre",
      ],
      besoin_status: ["cree", "pris_en_charge", "accepte", "refuse"],
      besoin_urgency: ["normale", "urgente", "critique"],
      bl_status: ["prepare", "en_attente_validation", "valide", "livre"],
      da_category: [
        "fournitures",
        "equipement",
        "service",
        "maintenance",
        "informatique",
        "autre",
      ],
      da_priority: ["basse", "normale", "haute", "urgente"],
      da_status: [
        "brouillon",
        "soumise",
        "rejetee",
        "en_analyse",
        "chiffree",
        "soumise_validation",
        "validee_finance",
        "refusee_finance",
        "en_revision_achats",
        "payee",
        "rejetee_comptabilite",
      ],
      user_status: ["active", "inactive", "suspended"],
    },
  },
} as const
