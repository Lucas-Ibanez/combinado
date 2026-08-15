export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          family_id: string
          id: string
          ip_address: string | null
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: string
          created_at?: string
          family_id: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          family_id?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      guardian_invites: {
        Row: {
          id: string
          family_id: string
          invited_by: string
          protected_person_id: string
          invite_code: string
          status: string
          accepted_by: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          invited_by: string
          protected_person_id: string
          invite_code: string
          status?: string
          accepted_by?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          invited_by?: string
          protected_person_id?: string
          invite_code?: string
          status?: string
          accepted_by?: string | null
          expires_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_invites_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_invites_protected_person_id_fkey"
            columns: ["protected_person_id"]
            isOneToOne: false
            referencedRelation: "protected_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      guardian_links: {
        Row: {
          created_at: string
          guardian_id: string
          id: string
          permissions: Json
          protected_person_id: string
          role: string
        }
        Insert: {
          created_at?: string
          guardian_id: string
          id?: string
          permissions?: Json
          protected_person_id: string
          role?: string
        }
        Update: {
          created_at?: string
          guardian_id?: string
          id?: string
          permissions?: Json
          protected_person_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardian_links_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guardian_links_protected_person_id_fkey"
            columns: ["protected_person_id"]
            isOneToOne: false
            referencedRelation: "protected_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      guardians: {
        Row: {
          created_at: string
          display_name: string
          family_id: string
          id: string
          is_primary: boolean
          phone: string | null
          push_subscription: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          family_id: string
          id: string
          is_primary?: boolean
          phone?: string | null
          push_subscription?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          family_id?: string
          id?: string
          is_primary?: boolean
          phone?: string | null
          push_subscription?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "guardians_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_deliveries: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          channel: string
          created_at: string
          delivered_at: string | null
          escalation_deadline: string | null
          failure_reason: string | null
          id: string
          incident_id: string
          sent_at: string | null
          step_order: number
          target_guardian_id: string | null
          target_phone: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          channel: string
          created_at?: string
          delivered_at?: string | null
          escalation_deadline?: string | null
          failure_reason?: string | null
          id?: string
          incident_id: string
          sent_at?: string | null
          step_order: number
          target_guardian_id?: string | null
          target_phone?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          channel?: string
          created_at?: string
          delivered_at?: string | null
          escalation_deadline?: string | null
          failure_reason?: string | null
          id?: string
          incident_id?: string
          sent_at?: string | null
          step_order?: number
          target_guardian_id?: string | null
          target_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_deliveries_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_deliveries_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incident_deliveries_target_guardian_id_fkey"
            columns: ["target_guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          closed_at: string | null
          created_at: string
          family_id: string
          id: string
          opened_at: string
          protected_person_id: string
          severity: string
          source_contact: string | null
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          closed_at?: string | null
          created_at?: string
          family_id: string
          id?: string
          opened_at?: string
          protected_person_id: string
          severity?: string
          source_contact?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          closed_at?: string | null
          created_at?: string
          family_id?: string
          id?: string
          opened_at?: string
          protected_person_id?: string
          severity?: string
          source_contact?: string | null
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_protected_person_id_fkey"
            columns: ["protected_person_id"]
            isOneToOne: false
            referencedRelation: "protected_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      protected_persons: {
        Row: {
          baileys_pairing_qr: string | null
          baileys_status: string
          created_at: string
          display_name: string
          family_id: string
          id: string
          opted_in: boolean
          panel_token: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          baileys_pairing_qr?: string | null
          baileys_status?: string
          created_at?: string
          display_name: string
          family_id: string
          id?: string
          opted_in?: boolean
          panel_token?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          baileys_pairing_qr?: string | null
          baileys_status?: string
          created_at?: string
          display_name?: string
          family_id?: string
          id?: string
          opted_in?: boolean
          panel_token?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protected_persons_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_events: {
        Row: {
          created_at: string
          decision: string
          family_id: string
          id: string
          incident_id: string | null
          pipeline_version: string | null
          processed_at: string
          protected_person_id: string
          severity: string
          signals: Json
        }
        Insert: {
          created_at?: string
          decision: string
          family_id: string
          id?: string
          incident_id?: string | null
          pipeline_version?: string | null
          processed_at?: string
          protected_person_id: string
          severity: string
          signals?: Json
        }
        Update: {
          created_at?: string
          decision?: string
          family_id?: string
          id?: string
          incident_id?: string | null
          pipeline_version?: string | null
          processed_at?: string
          protected_person_id?: string
          severity?: string
          signals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "risk_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_events_protected_person_id_fkey"
            columns: ["protected_person_id"]
            isOneToOne: false
            referencedRelation: "protected_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      secrets_family: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          encrypted_secret: string
          family_id: string
          hint: string | null
          id: string
          updated_at: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          encrypted_secret: string
          family_id: string
          hint?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          encrypted_secret?: string
          family_id?: string
          hint?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "secrets_family_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "secrets_family_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      simulations: {
        Row: {
          created_at: string
          family_id: string
          id: string
          protected_person_id: string
          requested_by: string
          responded_at: string | null
          response_correct: boolean | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          protected_person_id: string
          requested_by: string
          responded_at?: string | null
          response_correct?: boolean | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          protected_person_id?: string
          requested_by?: string
          responded_at?: string | null
          response_correct?: boolean | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulations_protected_person_id_fkey"
            columns: ["protected_person_id"]
            isOneToOne: false
            referencedRelation: "protected_persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite_tx: {
        Args: {
          p_user_id: string
          p_invite_code: string
          p_display_name: string
          p_phone?: string
        }
        Returns: Json
      }
      acknowledge_incident_tx: {
        Args: {
          p_family_id: string
          p_guardian_id: string
          p_incident_id: string
        }
        Returns: string
      }
      current_user_family_id: { Args: never; Returns: string }
      pair_device_tx: {
        Args: {
          p_family_id: string
          p_guardian_id: string
          p_idempotency_key?: string
          p_protected_person_id: string
        }
        Returns: string
      }
      queue_deadletter: {
        Args: {
          dlq_name: string
          message: Json
          msg_id: number
          queue_name: string
        }
        Returns: undefined
      }
      queue_delete: {
        Args: { msg_id: number; queue_name: string }
        Returns: boolean
      }
      queue_read: {
        Args: {
          batch_size: number
          queue_name: string
          visibility_seconds: number
        }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          vt: string
        }[]
      }
      queue_send: {
        Args: { message: Json; queue_name: string }
        Returns: number
      }
      setup_family_tx: {
        Args: {
          p_code_hint: string
          p_code_word: string
          p_guardian_id: string
          p_guardian_name: string
          p_guardian_phone: string
          p_protected_name: string
          p_protected_phone: string
          p_family_name: string
        }
        Returns: Json
      }
      start_simulation_tx: {
        Args: {
          p_family_id: string
          p_guardian_id: string
          p_idempotency_key?: string
          p_protected_person_id: string
        }
        Returns: string
      }
      get_protected_panel: {
        Args: {
          p_panel_token: string
        }
        Returns: Json
      }
      revoke_guardian_tx: {
        Args: {
          p_panel_token: string
          p_guardian_link_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
