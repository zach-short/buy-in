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
      bar_members: {
        Row: {
          bar_id: string
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_members_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      bars: {
        Row: {
          cashapp_handle: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
          venmo_handle: string | null
        }
        Insert: {
          cashapp_handle?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id: string
          venmo_handle?: string | null
        }
        Update: {
          cashapp_handle?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          venmo_handle?: string | null
        }
        Relationships: []
      }
      buy_ins: {
        Row: {
          amount_cents: number
          bar_id: string
          created_at: string
          id: string
          player_id: string
          session_id: string
        }
        Insert: {
          amount_cents: number
          bar_id: string
          created_at?: string
          id?: string
          player_id: string
          session_id: string
        }
        Update: {
          amount_cents?: number
          bar_id?: string
          created_at?: string
          id?: string
          player_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buy_ins_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buy_ins_player_id_bar_id_fkey"
            columns: ["player_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "buy_ins_session_id_bar_id_fkey"
            columns: ["session_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      cashouts: {
        Row: {
          amount_cents: number
          bar_id: string
          created_at: string
          id: string
          player_id: string
          session_id: string
        }
        Insert: {
          amount_cents: number
          bar_id: string
          created_at?: string
          id?: string
          player_id: string
          session_id: string
        }
        Update: {
          amount_cents?: number
          bar_id?: string
          created_at?: string
          id?: string
          player_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashouts_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashouts_player_id_bar_id_fkey"
            columns: ["player_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "cashouts_session_id_bar_id_fkey"
            columns: ["session_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      drink_ingredients: {
        Row: {
          bar_id: string
          drink_id: string
          item_id: string
          qty_used: number
        }
        Insert: {
          bar_id: string
          drink_id: string
          item_id: string
          qty_used: number
        }
        Update: {
          bar_id?: string
          drink_id?: string
          item_id?: string
          qty_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "drink_ingredients_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drink_ingredients_drink_id_bar_id_fkey"
            columns: ["drink_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "drinks"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "drink_ingredients_item_id_bar_id_fkey"
            columns: ["item_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      drinks: {
        Row: {
          bar_id: string
          cost_estimate_cents: number
          created_at: string
          id: string
          name: string
          price_cents: number
        }
        Insert: {
          bar_id: string
          cost_estimate_cents?: number
          created_at?: string
          id?: string
          name: string
          price_cents?: number
        }
        Update: {
          bar_id?: string
          cost_estimate_cents?: number
          created_at?: string
          id?: string
          name?: string
          price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "drinks_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          bar_id: string
          category: string
          cost_per_unit_cents: number
          created_at: string
          id: string
          name: string
          qty_on_hand: number
          reorder_threshold: number
          unit: string
        }
        Insert: {
          bar_id: string
          category: string
          cost_per_unit_cents?: number
          created_at?: string
          id?: string
          name: string
          qty_on_hand?: number
          reorder_threshold?: number
          unit: string
        }
        Update: {
          bar_id?: string
          category?: string
          cost_per_unit_cents?: number
          created_at?: string
          id?: string
          name?: string
          qty_on_hand?: number
          reorder_threshold?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          bar_id: string
          cost_estimate_cents: number
          created_at: string
          drink_id: string | null
          drink_name: string
          id: string
          ingredients: Json
          paid: boolean
          player_id: string
          price_cents: number
          session_id: string
        }
        Insert: {
          bar_id: string
          cost_estimate_cents?: number
          created_at?: string
          drink_id?: string | null
          drink_name: string
          id?: string
          ingredients?: Json
          paid?: boolean
          player_id: string
          price_cents: number
          session_id: string
        }
        Update: {
          bar_id?: string
          cost_estimate_cents?: number
          created_at?: string
          drink_id?: string | null
          drink_name?: string
          id?: string
          ingredients?: Json
          paid?: boolean
          player_id?: string
          price_cents?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_drink_id_bar_id_fkey"
            columns: ["drink_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "drinks"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "orders_player_id_bar_id_fkey"
            columns: ["player_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "orders_session_id_bar_id_fkey"
            columns: ["session_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          bar_id: string
          counterparty_player_id: string | null
          created_at: string
          direction: string
          id: string
          note: string
          player_id: string
          session_id: string | null
        }
        Insert: {
          amount_cents: number
          bar_id: string
          counterparty_player_id?: string | null
          created_at?: string
          direction: string
          id?: string
          note?: string
          player_id: string
          session_id?: string | null
        }
        Update: {
          amount_cents?: number
          bar_id?: string
          counterparty_player_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          note?: string
          player_id?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_counterparty_player_id_bar_id_fkey"
            columns: ["counterparty_player_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "payments_player_id_bar_id_fkey"
            columns: ["player_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "payments_session_id_bar_id_fkey"
            columns: ["session_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      player_claim_links: {
        Row: {
          bar_id: string
          claimed_at: string | null
          created_at: string
          expires_at: string
          player_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          bar_id: string
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          player_id: string
          revoked_at?: string | null
          token?: string
        }
        Update: {
          bar_id?: string
          claimed_at?: string | null
          created_at?: string
          expires_at?: string
          player_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_claim_links_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_claim_links_player_id_bar_id_fkey"
            columns: ["player_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      player_share_links: {
        Row: {
          bar_id: string
          created_at: string
          expires_at: string | null
          player_id: string
          revoked_at: string | null
          session_id: string | null
          token: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          expires_at?: string | null
          player_id: string
          revoked_at?: string | null
          session_id?: string | null
          token?: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          expires_at?: string | null
          player_id?: string
          revoked_at?: string | null
          session_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_share_links_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_share_links_player_id_bar_id_fkey"
            columns: ["player_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "player_share_links_session_id_bar_id_fkey"
            columns: ["session_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "player_share_links_session_id_player_id_fkey"
            columns: ["session_id", "player_id"]
            isOneToOne: false
            referencedRelation: "session_players"
            referencedColumns: ["session_id", "player_id"]
          },
        ]
      }
      players: {
        Row: {
          bar_id: string
          cashapp: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          user_id: string | null
          venmo: string | null
        }
        Insert: {
          bar_id: string
          cashapp?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          user_id?: string | null
          venmo?: string | null
        }
        Update: {
          bar_id?: string
          cashapp?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          user_id?: string | null
          venmo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
      session_players: {
        Row: {
          bar_id: string
          player_id: string
          session_id: string
        }
        Insert: {
          bar_id: string
          player_id: string
          session_id: string
        }
        Update: {
          bar_id?: string
          player_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_players_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_players_player_id_bar_id_fkey"
            columns: ["player_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "session_players_session_id_bar_id_fkey"
            columns: ["session_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
      sessions: {
        Row: {
          bar_id: string
          created_at: string
          id: string
          name: string
          played_on: string
          settle_mode: string
          status: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          id?: string
          name: string
          played_on?: string
          settle_mode?: string
          status?: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          id?: string
          name?: string
          played_on?: string
          settle_mode?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_session_player: {
        Args: {
          p_buy_in_cents: number
          p_player_id: string
          p_session_id: string
        }
        Returns: undefined
      }
      claim_player: { Args: { p_token: string }; Returns: string }
      create_bar: {
        Args: {
          p_cashapp_handle?: string
          p_name: string
          p_venmo_handle?: string
        }
        Returns: string
      }
      create_order: {
        Args: { p_drink_id: string; p_player_id: string; p_session_id: string }
        Returns: Json
      }
      delete_order: { Args: { p_order_id: string }; Returns: undefined }
      delete_session: { Args: { p_session_id: string }; Returns: undefined }
      get_menu: { Args: { p_bar_id: string }; Returns: Json }
      get_shared_tab: { Args: { p_token: string }; Returns: Json }
      is_bar_member: { Args: { b: string }; Returns: boolean }
      is_bar_staff: { Args: { b: string }; Returns: boolean }
      save_drink: {
        Args: {
          p_bar_id: string
          p_cost_estimate_cents: number
          p_drink_id?: string
          p_ingredients: Json
          p_name: string
          p_price_cents: number
        }
        Returns: string
      }
      start_session: {
        Args: { p_bar_id: string; p_name: string; p_players: Json }
        Returns: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
