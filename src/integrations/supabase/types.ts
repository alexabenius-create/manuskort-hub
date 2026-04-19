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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          content_html: string
          created_at: string
          cue_amber: string
          cue_red: string
          cue_teal: string
          end_time: string
          id: string
          is_panic_card: boolean
          manuscript_id: string
          notes: string
          position: number
          role: Database["public"]["Enums"]["card_role"]
          start_time: string
          target_seconds: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content_html?: string
          created_at?: string
          cue_amber?: string
          cue_red?: string
          cue_teal?: string
          end_time?: string
          id?: string
          is_panic_card?: boolean
          manuscript_id: string
          notes?: string
          position?: number
          role?: Database["public"]["Enums"]["card_role"]
          start_time?: string
          target_seconds?: number | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content_html?: string
          created_at?: string
          cue_amber?: string
          cue_red?: string
          cue_teal?: string
          end_time?: string
          id?: string
          is_panic_card?: boolean
          manuscript_id?: string
          notes?: string
          position?: number
          role?: Database["public"]["Enums"]["card_role"]
          start_time?: string
          target_seconds?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_manuscript_id_fkey"
            columns: ["manuscript_id"]
            isOneToOne: false
            referencedRelation: "manuscripts"
            referencedColumns: ["id"]
          },
        ]
      }
      manuscripts: {
        Row: {
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["manuscript_mode"]
          show_notes: boolean
          show_times: boolean
          tags: string[]
          target_duration_seconds: number | null
          text_size: string
          time_format: string
          title: string
          updated_at: string
          user_id: string
          wpm: number
        }
        Insert: {
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["manuscript_mode"]
          show_notes?: boolean
          show_times?: boolean
          tags?: string[]
          target_duration_seconds?: number | null
          text_size?: string
          time_format?: string
          title?: string
          updated_at?: string
          user_id: string
          wpm?: number
        }
        Update: {
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["manuscript_mode"]
          show_notes?: boolean
          show_times?: boolean
          tags?: string[]
          target_duration_seconds?: number | null
          text_size?: string
          time_format?: string
          title?: string
          updated_at?: string
          user_id?: string
          wpm?: number
        }
        Relationships: []
      }
      panelists: {
        Row: {
          color: string
          created_at: string
          id: string
          manuscript_id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          manuscript_id: string
          name?: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          manuscript_id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "panelists_manuscript_id_fkey"
            columns: ["manuscript_id"]
            isOneToOne: false
            referencedRelation: "manuscripts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bibliotek_tour_completed: boolean
          created_at: string
          email: string | null
          id: string
          manus_tour_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bibliotek_tour_completed?: boolean
          created_at?: string
          email?: string | null
          id?: string
          manus_tour_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bibliotek_tour_completed?: boolean
          created_at?: string
          email?: string | null
          id?: string
          manus_tour_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      admin_set_user_tier: {
        Args: {
          _new_tier: Database["public"]["Enums"]["app_role"]
          _target_user_id: string
        }
        Returns: undefined
      }
      get_user_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_manuscript: {
        Args: { p_cards: Json; p_manuscript: Json; p_panelists: Json }
        Returns: string
      }
    }
    Enums: {
      app_role: "free" | "pro" | "admin"
      card_role: "moderator" | "speaker"
      manuscript_mode: "moderator" | "speaker"
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
      app_role: ["free", "pro", "admin"],
      card_role: ["moderator", "speaker"],
      manuscript_mode: ["moderator", "speaker"],
    },
  },
} as const
