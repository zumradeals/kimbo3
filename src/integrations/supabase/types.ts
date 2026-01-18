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
      articles_stock: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string
          description: string | null
          designation: string
          id: string
          location: string | null
          quantity_available: number
          quantity_min: number | null
          quantity_reserved: number
          status: Database["public"]["Enums"]["stock_status"]
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          designation: string
          id?: string
          location?: string | null
          quantity_available?: number
          quantity_min?: number | null
          quantity_reserved?: number
          status?: Database["public"]["Enums"]["stock_status"]
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          designation?: string
          id?: string
          location?: string | null
          quantity_available?: number
          quantity_min?: number | null
          quantity_reserved?: number
          status?: Database["public"]["Enums"]["stock_status"]
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_stock_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "stock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "articles_stock_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      besoin_attachments: {
        Row: {
          besoin_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
        }
        Insert: {
          besoin_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
        }
        Update: {
          besoin_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "besoin_attachments_besoin_id_fkey"
            columns: ["besoin_id"]
            isOneToOne: false
            referencedRelation: "besoins"
            referencedColumns: ["id"]
          },
        ]
      }
      besoin_lignes: {
        Row: {
          article_stock_id: string | null
          besoin_id: string
          category: Database["public"]["Enums"]["besoin_ligne_category"]
          created_at: string
          designation: string
          id: string
          justification: string | null
          quantity: number
          unit: string
          urgency: Database["public"]["Enums"]["besoin_urgency"]
        }
        Insert: {
          article_stock_id?: string | null
          besoin_id: string
          category?: Database["public"]["Enums"]["besoin_ligne_category"]
          created_at?: string
          designation: string
          id?: string
          justification?: string | null
          quantity?: number
          unit?: string
          urgency?: Database["public"]["Enums"]["besoin_urgency"]
        }
        Update: {
          article_stock_id?: string | null
          besoin_id?: string
          category?: Database["public"]["Enums"]["besoin_ligne_category"]
          created_at?: string
          designation?: string
          id?: string
          justification?: string | null
          quantity?: number
          unit?: string
          urgency?: Database["public"]["Enums"]["besoin_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "besoin_lignes_article_stock_id_fkey"
            columns: ["article_stock_id"]
            isOneToOne: false
            referencedRelation: "articles_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "besoin_lignes_besoin_id_fkey"
            columns: ["besoin_id"]
            isOneToOne: false
            referencedRelation: "besoins"
            referencedColumns: ["id"]
          },
        ]
      }
      besoins: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          avance_caisse_montant: number | null
          besoin_avance_caisse: boolean | null
          besoin_type: string | null
          besoin_vehicule: boolean | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category: Database["public"]["Enums"]["besoin_category"]
          confirmation_engagement: boolean | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          department_id: string
          description: string
          desired_date: string | null
          estimated_quantity: number | null
          fournisseur_impose: boolean | null
          fournisseur_impose_contact: string | null
          fournisseur_impose_nom: string | null
          id: string
          intended_usage: string | null
          is_locked: boolean
          lieu_livraison: string | null
          locked_at: string | null
          locked_reason: string | null
          objet_besoin: string | null
          projet_id: string | null
          rejection_reason: string | null
          return_comment: string | null
          site_projet: string | null
          status: Database["public"]["Enums"]["besoin_status"]
          taken_at: string | null
          taken_by: string | null
          technical_specs: string | null
          title: string
          unit: string | null
          updated_at: string
          urgency: Database["public"]["Enums"]["besoin_urgency"]
          user_id: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          avance_caisse_montant?: number | null
          besoin_avance_caisse?: boolean | null
          besoin_type?: string | null
          besoin_vehicule?: boolean | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category: Database["public"]["Enums"]["besoin_category"]
          confirmation_engagement?: boolean | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          department_id: string
          description: string
          desired_date?: string | null
          estimated_quantity?: number | null
          fournisseur_impose?: boolean | null
          fournisseur_impose_contact?: string | null
          fournisseur_impose_nom?: string | null
          id?: string
          intended_usage?: string | null
          is_locked?: boolean
          lieu_livraison?: string | null
          locked_at?: string | null
          locked_reason?: string | null
          objet_besoin?: string | null
          projet_id?: string | null
          rejection_reason?: string | null
          return_comment?: string | null
          site_projet?: string | null
          status?: Database["public"]["Enums"]["besoin_status"]
          taken_at?: string | null
          taken_by?: string | null
          technical_specs?: string | null
          title: string
          unit?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["besoin_urgency"]
          user_id: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          avance_caisse_montant?: number | null
          besoin_avance_caisse?: boolean | null
          besoin_type?: string | null
          besoin_vehicule?: boolean | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category?: Database["public"]["Enums"]["besoin_category"]
          confirmation_engagement?: boolean | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          department_id?: string
          description?: string
          desired_date?: string | null
          estimated_quantity?: number | null
          fournisseur_impose?: boolean | null
          fournisseur_impose_contact?: string | null
          fournisseur_impose_nom?: string | null
          id?: string
          intended_usage?: string | null
          is_locked?: boolean
          lieu_livraison?: string | null
          locked_at?: string | null
          locked_reason?: string | null
          objet_besoin?: string | null
          projet_id?: string | null
          rejection_reason?: string | null
          return_comment?: string | null
          site_projet?: string | null
          status?: Database["public"]["Enums"]["besoin_status"]
          taken_at?: string | null
          taken_by?: string | null
          technical_specs?: string | null
          title?: string
          unit?: string | null
          updated_at?: string
          urgency?: Database["public"]["Enums"]["besoin_urgency"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "besoins_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "besoins_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
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
          article_stock_id: string | null
          bl_id: string
          created_at: string
          designation: string
          ecart_reason: string | null
          id: string
          observations: string | null
          quantity: number
          quantity_delivered: number | null
          quantity_ordered: number | null
          unit: string
        }
        Insert: {
          article_stock_id?: string | null
          bl_id: string
          created_at?: string
          designation: string
          ecart_reason?: string | null
          id?: string
          observations?: string | null
          quantity: number
          quantity_delivered?: number | null
          quantity_ordered?: number | null
          unit?: string
        }
        Update: {
          article_stock_id?: string | null
          bl_id?: string
          created_at?: string
          designation?: string
          ecart_reason?: string | null
          id?: string
          observations?: string | null
          quantity?: number
          quantity_delivered?: number | null
          quantity_ordered?: number | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "bl_articles_article_stock_id_fkey"
            columns: ["article_stock_id"]
            isOneToOne: false
            referencedRelation: "articles_stock"
            referencedColumns: ["id"]
          },
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
          bl_type: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string
          delivered_at: string | null
          delivered_by: string | null
          delivery_date: string | null
          department_id: string
          id: string
          observations: string | null
          projet_id: string | null
          reference: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["bl_status"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
          warehouse: string | null
        }
        Insert: {
          besoin_id: string
          bl_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          department_id: string
          id?: string
          observations?: string | null
          projet_id?: string | null
          reference: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["bl_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
          warehouse?: string | null
        }
        Update: {
          besoin_id?: string
          bl_type?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_date?: string | null
          department_id?: string
          id?: string
          observations?: string | null
          projet_id?: string | null
          reference?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
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
            foreignKeyName: "bons_livraison_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "bons_livraison_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bons_livraison_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      caisse_mouvements: {
        Row: {
          caisse_id: string
          correction_of_id: string | null
          correction_reason: string | null
          created_at: string
          created_by: string
          da_id: string | null
          id: string
          montant: number
          motif: string
          note_frais_id: string | null
          observations: string | null
          payment_class: Database["public"]["Enums"]["payment_class"] | null
          reference: string
          solde_apres: number
          solde_avant: number
          transfer_id: string | null
          type: string
        }
        Insert: {
          caisse_id: string
          correction_of_id?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by: string
          da_id?: string | null
          id?: string
          montant: number
          motif: string
          note_frais_id?: string | null
          observations?: string | null
          payment_class?: Database["public"]["Enums"]["payment_class"] | null
          reference: string
          solde_apres: number
          solde_avant: number
          transfer_id?: string | null
          type: string
        }
        Update: {
          caisse_id?: string
          correction_of_id?: string | null
          correction_reason?: string | null
          created_at?: string
          created_by?: string
          da_id?: string | null
          id?: string
          montant?: number
          motif?: string
          note_frais_id?: string | null
          observations?: string | null
          payment_class?: Database["public"]["Enums"]["payment_class"] | null
          reference?: string
          solde_apres?: number
          solde_avant?: number
          transfer_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "caisse_mouvements_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caisse_mouvements_correction_of_id_fkey"
            columns: ["correction_of_id"]
            isOneToOne: false
            referencedRelation: "caisse_mouvements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caisse_mouvements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caisse_mouvements_da_id_fkey"
            columns: ["da_id"]
            isOneToOne: false
            referencedRelation: "demandes_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caisse_mouvements_note_frais_id_fkey"
            columns: ["note_frais_id"]
            isOneToOne: false
            referencedRelation: "notes_frais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caisse_mouvements_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "caisse_mouvements"
            referencedColumns: ["id"]
          },
        ]
      }
      caisses: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          devise: string
          id: string
          is_active: boolean
          name: string
          responsable_id: string | null
          solde_actuel: number
          solde_initial: number
          type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          devise?: string
          id?: string
          is_active?: boolean
          name: string
          responsable_id?: string | null
          solde_actuel?: number
          solde_initial?: number
          type?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          devise?: string
          id?: string
          is_active?: boolean
          name?: string
          responsable_id?: string | null
          solde_actuel?: number
          solde_initial?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "caisses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caisses_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comptes_comptables: {
        Row: {
          classe: number
          code: string
          created_at: string
          id: string
          is_active: boolean
          libelle: string
        }
        Insert: {
          classe: number
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          libelle: string
        }
        Update: {
          classe?: number
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          libelle?: string
        }
        Relationships: []
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
          attachment_name: string | null
          attachment_url: string | null
          besoin_id: string
          caisse_id: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          category: Database["public"]["Enums"]["da_category"]
          comptabilise_at: string | null
          comptabilise_by: string | null
          comptabilite_rejection_reason: string | null
          created_at: string
          created_by: string
          currency: string | null
          department_id: string
          description: string
          desired_date: string | null
          finance_decision_comment: string | null
          fournisseur_justification: string | null
          id: string
          mode_paiement: string | null
          observations: string | null
          payment_category_id: string | null
          payment_class: Database["public"]["Enums"]["payment_class"] | null
          payment_details: Json | null
          payment_method_id: string | null
          priced_at: string | null
          priced_by: string | null
          priority: Database["public"]["Enums"]["da_priority"]
          projet_id: string | null
          reference: string
          reference_paiement: string | null
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
          syscohada_centre_cout: string | null
          syscohada_classe: number | null
          syscohada_compte: string | null
          syscohada_nature_charge: string | null
          total_amount: number | null
          updated_at: string
          validated_finance_at: string | null
          validated_finance_by: string | null
        }
        Insert: {
          analyzed_at?: string | null
          analyzed_by?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          besoin_id: string
          caisse_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category: Database["public"]["Enums"]["da_category"]
          comptabilise_at?: string | null
          comptabilise_by?: string | null
          comptabilite_rejection_reason?: string | null
          created_at?: string
          created_by: string
          currency?: string | null
          department_id: string
          description: string
          desired_date?: string | null
          finance_decision_comment?: string | null
          fournisseur_justification?: string | null
          id?: string
          mode_paiement?: string | null
          observations?: string | null
          payment_category_id?: string | null
          payment_class?: Database["public"]["Enums"]["payment_class"] | null
          payment_details?: Json | null
          payment_method_id?: string | null
          priced_at?: string | null
          priced_by?: string | null
          priority?: Database["public"]["Enums"]["da_priority"]
          projet_id?: string | null
          reference: string
          reference_paiement?: string | null
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
          syscohada_centre_cout?: string | null
          syscohada_classe?: number | null
          syscohada_compte?: string | null
          syscohada_nature_charge?: string | null
          total_amount?: number | null
          updated_at?: string
          validated_finance_at?: string | null
          validated_finance_by?: string | null
        }
        Update: {
          analyzed_at?: string | null
          analyzed_by?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          besoin_id?: string
          caisse_id?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          category?: Database["public"]["Enums"]["da_category"]
          comptabilise_at?: string | null
          comptabilise_by?: string | null
          comptabilite_rejection_reason?: string | null
          created_at?: string
          created_by?: string
          currency?: string | null
          department_id?: string
          description?: string
          desired_date?: string | null
          finance_decision_comment?: string | null
          fournisseur_justification?: string | null
          id?: string
          mode_paiement?: string | null
          observations?: string | null
          payment_category_id?: string | null
          payment_class?: Database["public"]["Enums"]["payment_class"] | null
          payment_details?: Json | null
          payment_method_id?: string | null
          priced_at?: string | null
          priced_by?: string | null
          priority?: Database["public"]["Enums"]["da_priority"]
          projet_id?: string | null
          reference?: string
          reference_paiement?: string | null
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
          syscohada_centre_cout?: string | null
          syscohada_classe?: number | null
          syscohada_compte?: string | null
          syscohada_nature_charge?: string | null
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
            foreignKeyName: "demandes_achat_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_comptabilise_by_fkey"
            columns: ["comptabilise_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "demandes_achat_payment_category_id_fkey"
            columns: ["payment_category_id"]
            isOneToOne: false
            referencedRelation: "payment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demandes_achat_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
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
            foreignKeyName: "demandes_achat_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
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
      ecritures_comptables: {
        Row: {
          centre_cout: string | null
          classe_syscohada: number
          compte_comptable: string
          created_at: string
          created_by: string
          credit: number
          da_id: string | null
          date_ecriture: string
          debit: number
          devise: string
          id: string
          is_validated: boolean
          libelle: string
          mode_paiement: string | null
          nature_charge: string
          note_frais_id: string | null
          observations: string | null
          reference: string
          reference_paiement: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          centre_cout?: string | null
          classe_syscohada: number
          compte_comptable: string
          created_at?: string
          created_by: string
          credit?: number
          da_id?: string | null
          date_ecriture?: string
          debit?: number
          devise?: string
          id?: string
          is_validated?: boolean
          libelle: string
          mode_paiement?: string | null
          nature_charge: string
          note_frais_id?: string | null
          observations?: string | null
          reference: string
          reference_paiement?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          centre_cout?: string | null
          classe_syscohada?: number
          compte_comptable?: string
          created_at?: string
          created_by?: string
          credit?: number
          da_id?: string | null
          date_ecriture?: string
          debit?: number
          devise?: string
          id?: string
          is_validated?: boolean
          libelle?: string
          mode_paiement?: string | null
          nature_charge?: string
          note_frais_id?: string | null
          observations?: string | null
          reference?: string
          reference_paiement?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ecritures_comptables_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecritures_comptables_da_id_fkey"
            columns: ["da_id"]
            isOneToOne: false
            referencedRelation: "demandes_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecritures_comptables_note_frais_id_fkey"
            columns: ["note_frais_id"]
            isOneToOne: false
            referencedRelation: "notes_frais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecritures_comptables_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expressions_besoin: {
        Row: {
          besoin_id: string | null
          chef_validateur_id: string | null
          commentaire: string | null
          created_at: string
          department_id: string
          id: string
          nom_article: string
          precision_technique: string | null
          quantite: number | null
          rejected_at: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          sent_to_logistics_at: string | null
          status: Database["public"]["Enums"]["expression_besoin_status_v2"]
          status_old: Database["public"]["Enums"]["expression_besoin_status"]
          submitted_at: string | null
          unite: string | null
          updated_at: string
          user_id: string
          validated_at: string | null
        }
        Insert: {
          besoin_id?: string | null
          chef_validateur_id?: string | null
          commentaire?: string | null
          created_at?: string
          department_id: string
          id?: string
          nom_article: string
          precision_technique?: string | null
          quantite?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          sent_to_logistics_at?: string | null
          status?: Database["public"]["Enums"]["expression_besoin_status_v2"]
          status_old?: Database["public"]["Enums"]["expression_besoin_status"]
          submitted_at?: string | null
          unite?: string | null
          updated_at?: string
          user_id: string
          validated_at?: string | null
        }
        Update: {
          besoin_id?: string | null
          chef_validateur_id?: string | null
          commentaire?: string | null
          created_at?: string
          department_id?: string
          id?: string
          nom_article?: string
          precision_technique?: string | null
          quantite?: number | null
          rejected_at?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          sent_to_logistics_at?: string | null
          status?: Database["public"]["Enums"]["expression_besoin_status_v2"]
          status_old?: Database["public"]["Enums"]["expression_besoin_status"]
          submitted_at?: string | null
          unite?: string | null
          updated_at?: string
          user_id?: string
          validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expressions_besoin_besoin_id_fkey"
            columns: ["besoin_id"]
            isOneToOne: false
            referencedRelation: "besoins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expressions_besoin_chef_validateur_id_fkey"
            columns: ["chef_validateur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expressions_besoin_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expressions_besoin_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fournisseurs: {
        Row: {
          address: string | null
          contact_name: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
          deleted_at?: string | null
          deleted_by?: string | null
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
      governance_derogations: {
        Row: {
          approval_date: string
          approved_by: string
          created_at: string
          derogation_type: string
          description: string
          expiration_date: string | null
          id: string
          is_active: boolean
          justification: string
          review_frequency: string | null
          role_concerned: string
          updated_at: string
        }
        Insert: {
          approval_date: string
          approved_by: string
          created_at?: string
          derogation_type: string
          description: string
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          justification: string
          review_frequency?: string | null
          role_concerned: string
          updated_at?: string
        }
        Update: {
          approval_date?: string
          approved_by?: string
          created_at?: string
          derogation_type?: string
          description?: string
          expiration_date?: string | null
          id?: string
          is_active?: boolean
          justification?: string
          review_frequency?: string | null
          role_concerned?: string
          updated_at?: string
        }
        Relationships: []
      }
      note_frais_lignes: {
        Row: {
          created_at: string
          date_depense: string
          id: string
          justificatif_name: string | null
          justificatif_url: string | null
          montant: number
          motif: string
          note_frais_id: string
          observations: string | null
          projet_id: string | null
        }
        Insert: {
          created_at?: string
          date_depense: string
          id?: string
          justificatif_name?: string | null
          justificatif_url?: string | null
          montant: number
          motif: string
          note_frais_id: string
          observations?: string | null
          projet_id?: string | null
        }
        Update: {
          created_at?: string
          date_depense?: string
          id?: string
          justificatif_name?: string | null
          justificatif_url?: string | null
          montant?: number
          motif?: string
          note_frais_id?: string
          observations?: string | null
          projet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_frais_lignes_note_frais_id_fkey"
            columns: ["note_frais_id"]
            isOneToOne: false
            referencedRelation: "notes_frais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_frais_lignes_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
        ]
      }
      notes_frais: {
        Row: {
          caisse_id: string | null
          comptabilise_at: string | null
          comptabilise_by: string | null
          created_at: string
          currency: string
          department_id: string
          description: string | null
          id: string
          mode_paiement: string | null
          paid_at: string | null
          paid_by: string | null
          payment_category_id: string | null
          payment_class: Database["public"]["Enums"]["payment_class"] | null
          payment_details: Json | null
          payment_method_id: string | null
          projet_id: string | null
          reference: string
          reference_paiement: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["note_frais_status"]
          submitted_at: string | null
          syscohada_centre_cout: string | null
          syscohada_classe: number | null
          syscohada_compte: string | null
          syscohada_nature_charge: string | null
          title: string
          total_amount: number
          updated_at: string
          user_id: string
          validated_daf_at: string | null
          validated_daf_by: string | null
        }
        Insert: {
          caisse_id?: string | null
          comptabilise_at?: string | null
          comptabilise_by?: string | null
          created_at?: string
          currency?: string
          department_id: string
          description?: string | null
          id?: string
          mode_paiement?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_category_id?: string | null
          payment_class?: Database["public"]["Enums"]["payment_class"] | null
          payment_details?: Json | null
          payment_method_id?: string | null
          projet_id?: string | null
          reference: string
          reference_paiement?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["note_frais_status"]
          submitted_at?: string | null
          syscohada_centre_cout?: string | null
          syscohada_classe?: number | null
          syscohada_compte?: string | null
          syscohada_nature_charge?: string | null
          title: string
          total_amount?: number
          updated_at?: string
          user_id: string
          validated_daf_at?: string | null
          validated_daf_by?: string | null
        }
        Update: {
          caisse_id?: string | null
          comptabilise_at?: string | null
          comptabilise_by?: string | null
          created_at?: string
          currency?: string
          department_id?: string
          description?: string | null
          id?: string
          mode_paiement?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_category_id?: string | null
          payment_class?: Database["public"]["Enums"]["payment_class"] | null
          payment_details?: Json | null
          payment_method_id?: string | null
          projet_id?: string | null
          reference?: string
          reference_paiement?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["note_frais_status"]
          submitted_at?: string | null
          syscohada_centre_cout?: string | null
          syscohada_classe?: number | null
          syscohada_compte?: string | null
          syscohada_nature_charge?: string | null
          title?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
          validated_daf_at?: string | null
          validated_daf_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_frais_caisse_id_fkey"
            columns: ["caisse_id"]
            isOneToOne: false
            referencedRelation: "caisses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_frais_comptabilise_by_fkey"
            columns: ["comptabilise_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_frais_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_frais_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_frais_payment_category_id_fkey"
            columns: ["payment_category_id"]
            isOneToOne: false
            referencedRelation: "payment_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_frais_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_frais_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_frais_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_frais_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_frais_validated_daf_by_fkey"
            columns: ["validated_daf_by"]
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
      payment_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          required_fields: Json | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          required_fields?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          required_fields?: Json | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          extra_fields: Json | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          extra_fields?: Json | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          extra_fields?: Json | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "payment_categories"
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
          chef_hierarchique_id: string | null
          created_at: string
          department_id: string | null
          email: string
          first_name: string | null
          fonction: string | null
          id: string
          last_name: string | null
          photo_url: string | null
          position_departement: string | null
          status: Database["public"]["Enums"]["user_status"]
          statut_utilisateur: string | null
          updated_at: string
        }
        Insert: {
          chef_hierarchique_id?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          first_name?: string | null
          fonction?: string | null
          id: string
          last_name?: string | null
          photo_url?: string | null
          position_departement?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          statut_utilisateur?: string | null
          updated_at?: string
        }
        Update: {
          chef_hierarchique_id?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          first_name?: string | null
          fonction?: string | null
          id?: string
          last_name?: string | null
          photo_url?: string | null
          position_departement?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          statut_utilisateur?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_chef_hierarchique_id_fkey"
            columns: ["chef_hierarchique_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      projets: {
        Row: {
          budget: number | null
          client: string | null
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          location: string | null
          name: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          client?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          client?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          role_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          label: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          label?: string
          updated_at?: string
        }
        Relationships: []
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
      stock_categories: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "stock_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          article_stock_id: string
          bl_id: string | null
          created_at: string
          created_by: string
          da_id: string | null
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          observations: string | null
          projet_id: string | null
          quantity: number
          quantity_after: number
          quantity_before: number
          reference: string
        }
        Insert: {
          article_stock_id: string
          bl_id?: string | null
          created_at?: string
          created_by: string
          da_id?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          observations?: string | null
          projet_id?: string | null
          quantity: number
          quantity_after: number
          quantity_before: number
          reference: string
        }
        Update: {
          article_stock_id?: string
          bl_id?: string | null
          created_at?: string
          created_by?: string
          da_id?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          observations?: string | null
          projet_id?: string | null
          quantity?: number
          quantity_after?: number
          quantity_before?: number
          reference?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_article_stock_id_fkey"
            columns: ["article_stock_id"]
            isOneToOne: false
            referencedRelation: "articles_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_bl_id_fkey"
            columns: ["bl_id"]
            isOneToOne: false
            referencedRelation: "bons_livraison"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_da_id_fkey"
            columns: ["da_id"]
            isOneToOne: false
            referencedRelation: "demandes_achat"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_projet_id_fkey"
            columns: ["projet_id"]
            isOneToOne: false
            referencedRelation: "projets"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_id: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approvisionner_caisse: {
        Args: {
          p_caisse_id: string
          p_montant: number
          p_motif: string
          p_observations?: string
        }
        Returns: string
      }
      can_create_besoin: { Args: { _user_id: string }; Returns: boolean }
      can_transform_besoin: { Args: { _besoin_id: string }; Returns: boolean }
      can_validate_expression: {
        Args: { _expression_id: string }
        Returns: boolean
      }
      corriger_caisse_note_frais: {
        Args: {
          p_note_frais_id: string
          p_nouvelle_caisse_id: string
          p_raison: string
        }
        Returns: string
      }
      corriger_caisse_paiement: {
        Args: {
          p_da_id: string
          p_nouvelle_caisse_id: string
          p_raison: string
        }
        Returns: string
      }
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
      dashboard_summary_by_role: { Args: { _user_id: string }; Returns: Json }
      generate_bl_reference: { Args: never; Returns: string }
      generate_da_reference: { Args: never; Returns: string }
      generate_ecriture_reference: { Args: never; Returns: string }
      generate_ndf_reference: { Args: never; Returns: string }
      get_public_profiles: {
        Args: { _user_ids: string[] }
        Returns: {
          department_name: string
          email: string
          first_name: string
          fonction: string
          id: string
          last_name: string
          photo_url: string
        }[]
      }
      get_user_department: { Args: { _user_id: string }; Returns: string }
      get_user_modules: {
        Args: { _user_id: string }
        Returns: {
          module: string
        }[]
      }
      get_user_permissions: {
        Args: { _user_id: string }
        Returns: {
          module: string
          name: string
          permission_code: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          role_code: string
          role_id: string
          role_label: string
        }[]
      }
      has_permission: {
        Args: { _permission_code: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_by_code: {
        Args: { _role_code: string; _user_id: string }
        Returns: boolean
      }
      is_achats: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_comptable: { Args: { _user_id: string }; Returns: boolean }
      is_dg: { Args: { _user_id: string }; Returns: boolean }
      is_logistics: { Args: { _user_id: string }; Returns: boolean }
      is_manager_of: {
        Args: { _employee_id: string; _manager_id: string }
        Returns: boolean
      }
      recalculate_caisse_solde: {
        Args: { p_caisse_id: string }
        Returns: number
      }
      reject_expression_by_manager: {
        Args: { _expression_id: string; _rejection_reason: string }
        Returns: boolean
      }
      submit_expression_for_validation: {
        Args: { _expression_id: string }
        Returns: boolean
      }
      submit_expression_to_logistics: {
        Args: { _expression_id: string }
        Returns: string
      }
      transferer_entre_caisses: {
        Args: {
          p_caisse_dest_id: string
          p_caisse_source_id: string
          p_montant: number
          p_motif: string
          p_observations?: string
        }
        Returns: string
      }
      user_can_insert_besoin_ligne: {
        Args: { _besoin_id: string; _user_id: string }
        Returns: boolean
      }
      validate_expression_by_manager: {
        Args: {
          _expression_id: string
          _precision_technique?: string
          _quantite: number
          _unite?: string
        }
        Returns: boolean
      }
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
      besoin_ligne_category: "materiel" | "service" | "transport" | "autre"
      besoin_status:
        | "cree"
        | "pris_en_charge"
        | "accepte"
        | "refuse"
        | "retourne"
        | "annulee"
      besoin_type_enum:
        | "achat"
        | "transport"
        | "service"
        | "reparation"
        | "location"
        | "main_oeuvre"
      besoin_urgency: "normale" | "urgente" | "critique"
      bl_status:
        | "prepare"
        | "en_attente_validation"
        | "valide"
        | "livre"
        | "livree_partiellement"
        | "refusee"
        | "annulee"
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
        | "annulee"
      expression_besoin_status: "en_attente" | "validee" | "rejetee"
      expression_besoin_status_v2:
        | "brouillon"
        | "soumis"
        | "en_examen"
        | "valide_departement"
        | "rejete_departement"
        | "envoye_logistique"
      note_frais_status:
        | "brouillon"
        | "soumise"
        | "validee_daf"
        | "payee"
        | "rejetee"
      payment_class: "REGLEMENT" | "DEPENSE"
      stock_movement_type:
        | "entree"
        | "sortie"
        | "ajustement"
        | "reservation"
        | "liberation"
      stock_status: "disponible" | "reserve" | "epuise"
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
      besoin_ligne_category: ["materiel", "service", "transport", "autre"],
      besoin_status: [
        "cree",
        "pris_en_charge",
        "accepte",
        "refuse",
        "retourne",
        "annulee",
      ],
      besoin_type_enum: [
        "achat",
        "transport",
        "service",
        "reparation",
        "location",
        "main_oeuvre",
      ],
      besoin_urgency: ["normale", "urgente", "critique"],
      bl_status: [
        "prepare",
        "en_attente_validation",
        "valide",
        "livre",
        "livree_partiellement",
        "refusee",
        "annulee",
      ],
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
        "annulee",
      ],
      expression_besoin_status: ["en_attente", "validee", "rejetee"],
      expression_besoin_status_v2: [
        "brouillon",
        "soumis",
        "en_examen",
        "valide_departement",
        "rejete_departement",
        "envoye_logistique",
      ],
      note_frais_status: [
        "brouillon",
        "soumise",
        "validee_daf",
        "payee",
        "rejetee",
      ],
      payment_class: ["REGLEMENT", "DEPENSE"],
      stock_movement_type: [
        "entree",
        "sortie",
        "ajustement",
        "reservation",
        "liberation",
      ],
      stock_status: ["disponible", "reserve", "epuise"],
      user_status: ["active", "inactive", "suspended"],
    },
  },
} as const
