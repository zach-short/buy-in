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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bar_invite_links: {
        Row: {
          bar_id: string
          created_at: string
          created_by: string
          expires_at: string
          revoked_at: string | null
          scheduled_game_id: string | null
          token: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          created_by: string
          expires_at?: string
          revoked_at?: string | null
          scheduled_game_id?: string | null
          token?: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          revoked_at?: string | null
          scheduled_game_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "bar_invite_links_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bar_invite_links_scheduled_game_id_bar_id_fkey"
            columns: ["scheduled_game_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "scheduled_games"
            referencedColumns: ["id", "bar_id"]
          },
        ]
      }
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
          claim_by_name: boolean
          created_at: string
          default_buy_in_cents: number
          default_buy_in_set_at: string | null
          drinks_allowed: boolean
          id: string
          name: string
          owner_id: string
          serves_drinks: boolean
          setup_dismissed_at: string | null
          tracks_inventory: boolean
          venmo_handle: string | null
          venmo_note_template: string | null
        }
        Insert: {
          cashapp_handle?: string | null
          claim_by_name?: boolean
          created_at?: string
          default_buy_in_cents?: number
          default_buy_in_set_at?: string | null
          drinks_allowed?: boolean
          id?: string
          name: string
          owner_id: string
          serves_drinks?: boolean
          setup_dismissed_at?: string | null
          tracks_inventory?: boolean
          venmo_handle?: string | null
          venmo_note_template?: string | null
        }
        Update: {
          cashapp_handle?: string | null
          claim_by_name?: boolean
          created_at?: string
          default_buy_in_cents?: number
          default_buy_in_set_at?: string | null
          drinks_allowed?: boolean
          id?: string
          name?: string
          owner_id?: string
          serves_drinks?: boolean
          setup_dismissed_at?: string | null
          tracks_inventory?: boolean
          venmo_handle?: string | null
          venmo_note_template?: string | null
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
          archived_at: string | null
          bar_id: string
          cost_estimate_cents: number
          created_at: string
          id: string
          name: string
          price_cents: number
        }
        Insert: {
          archived_at?: string | null
          bar_id: string
          cost_estimate_cents?: number
          created_at?: string
          id?: string
          name: string
          price_cents?: number
        }
        Update: {
          archived_at?: string | null
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
      game_rsvps: {
        Row: {
          created_at: string
          id: string
          scheduled_game_id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          scheduled_game_id: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          scheduled_game_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rsvps_scheduled_game_id_fkey"
            columns: ["scheduled_game_id"]
            isOneToOne: false
            referencedRelation: "scheduled_games"
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
      logged_sessions: {
        Row: {
          big_blind_cents: number
          buy_in_cents: number
          cash_out_cents: number
          created_at: string
          game_format: string | null
          id: string
          minutes_played: number | null
          note: string | null
          played_on: string
          small_blind_cents: number
          straddle_cents: number | null
          user_id: string
          venue: string
        }
        Insert: {
          big_blind_cents: number
          buy_in_cents: number
          cash_out_cents: number
          created_at?: string
          game_format?: string | null
          id?: string
          minutes_played?: number | null
          note?: string | null
          played_on: string
          small_blind_cents: number
          straddle_cents?: number | null
          user_id?: string
          venue: string
        }
        Update: {
          big_blind_cents?: number
          buy_in_cents?: number
          cash_out_cents?: number
          created_at?: string
          game_format?: string | null
          id?: string
          minutes_played?: number | null
          note?: string | null
          played_on?: string
          small_blind_cents?: number
          straddle_cents?: number | null
          user_id?: string
          venue?: string
        }
        Relationships: []
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
      payment_reports: {
        Row: {
          amount_cents: number
          bar_id: string
          created_at: string
          decided_at: string | null
          id: string
          note: string | null
          payment_id: string | null
          player_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          bar_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          note?: string | null
          payment_id?: string | null
          player_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          bar_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          note?: string | null
          payment_id?: string | null
          player_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_reports_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reports_payment_id_bar_id_fkey"
            columns: ["payment_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id", "bar_id"]
          },
          {
            foreignKeyName: "payment_reports_player_id_bar_id_fkey"
            columns: ["player_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "players"
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
      player_claim_requests: {
        Row: {
          bar_id: string
          created_at: string
          decided_at: string | null
          id: string
          player_id: string
          requester_email: string | null
          requester_name: string | null
          status: string
          user_id: string
        }
        Insert: {
          bar_id: string
          created_at?: string
          decided_at?: string | null
          id?: string
          player_id: string
          requester_email?: string | null
          requester_name?: string | null
          status?: string
          user_id: string
        }
        Update: {
          bar_id?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          player_id?: string
          requester_email?: string | null
          requester_name?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_claim_requests_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_claim_requests_player_id_bar_id_fkey"
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
          archived_at: string | null
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
          archived_at?: string | null
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
          archived_at?: string | null
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
      scheduled_games: {
        Row: {
          bar_id: string
          cancelled_at: string | null
          created_at: string
          host_user_id: string
          id: string
          name: string
          scheduled_at: string
          session_id: string | null
        }
        Insert: {
          bar_id: string
          cancelled_at?: string | null
          created_at?: string
          host_user_id: string
          id?: string
          name: string
          scheduled_at: string
          session_id?: string | null
        }
        Update: {
          bar_id?: string
          cancelled_at?: string | null
          created_at?: string
          host_user_id?: string
          id?: string
          name?: string
          scheduled_at?: string
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_games_bar_id_fkey"
            columns: ["bar_id"]
            isOneToOne: false
            referencedRelation: "bars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_games_session_id_bar_id_fkey"
            columns: ["session_id", "bar_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id", "bar_id"]
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
      close_stale_claim_requests: {
        Args: { p_bar_id: string }
        Returns: undefined
      }
      confirm_payment_report: {
        Args: { p_amount_cents?: number; p_id: string }
        Returns: string
      }
      create_bar: {
        Args: {
          p_cashapp_handle?: string
          p_name: string
          p_venmo_handle?: string
        }
        Returns: string
      }
      create_bar_invite: {
        Args: { p_bar_id: string; p_scheduled_game_id?: string }
        Returns: string
      }
      create_order: {
        Args: {
          p_allow_short?: boolean
          p_drink_id: string
          p_player_id: string
          p_session_id: string
        }
        Returns: Json
      }
      create_scheduled_game: {
        Args: { p_bar_id: string; p_name: string; p_scheduled_at: string }
        Returns: string
      }
      decide_player_claim: {
        Args: { p_approve: boolean; p_request_id: string }
        Returns: string
      }
      delete_my_account: { Args: never; Returns: undefined }
      delete_order: { Args: { p_order_id: string }; Returns: undefined }
      delete_session: { Args: { p_session_id: string }; Returns: undefined }
      dismiss_payment_report: { Args: { p_id: string }; Returns: undefined }
      email_has_account: { Args: { p_email: string }; Returns: boolean }
      get_account_deletion_check: { Args: never; Returns: Json }
      get_invite_preview: { Args: { p_token: string }; Returns: Json }
      get_menu: { Args: { p_bar_id: string }; Returns: Json }
      get_my_performance: {
        Args: never
        Returns: {
          bar_id: string
          bar_name: string
          net_cents: number
          played_on: string
          session_id: string
          session_name: string
          stakes_cents: number
        }[]
      }
      get_my_tables: {
        Args: never
        Returns: {
          balance_cents: number
          bar_id: string
          bar_name: string
        }[]
      }
      get_my_upcoming_games: {
        Args: { p_stale_hours: number; p_window_days: number }
        Returns: {
          bar_id: string
          game_id: string
          my_status: string
          name: string
          scheduled_at: string
        }[]
      }
      get_rsvp_game: {
        Args: { p_token: string }
        Returns: {
          bar_name: string
          cancelled: boolean
          game_name: string
          host_name: string
          my_status: string
          scheduled_at: string
          started: boolean
        }[]
      }
      get_shared_tab: { Args: { p_token: string }; Returns: Json }
      is_bar_member: { Args: { b: string }; Returns: boolean }
      is_bar_staff: { Args: { b: string }; Returns: boolean }
      join_bar_as_player: {
        Args: { p_name: string; p_token: string }
        Returns: string
      }
      leave_table: {
        Args: { p_accept_credit?: boolean; p_bar_id: string }
        Returns: undefined
      }
      list_claimable_players: {
        Args: { p_token: string }
        Returns: {
          has_pending_request: boolean
          id: string
          name: string
        }[]
      }
      merge_players: {
        Args: { p_from: string; p_into: string }
        Returns: undefined
      }
      my_bar_ids: { Args: never; Returns: string[] }
      my_payment_reports: { Args: { p_token: string }; Returns: Json }
      my_staff_bar_ids: { Args: never; Returns: string[] }
      payment_report_player: {
        Args: { p_token: string }
        Returns: {
          archived_at: string | null
          bar_id: string
          cashapp: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          user_id: string | null
          venmo: string | null
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      player_balance_cents: { Args: { p_player_id: string }; Returns: number }
      reassign_player_account: {
        Args: { p_from: string; p_to: string }
        Returns: undefined
      }
      report_payment: {
        Args: { p_amount_cents: number; p_note?: string; p_token: string }
        Returns: string
      }
      request_player_claim: {
        Args: { p_player_id: string; p_token: string }
        Returns: string
      }
      revoke_bar_invite: { Args: { p_token: string }; Returns: undefined }
      rsvp_my_game: {
        Args: { p_game_id: string; p_status: string }
        Returns: undefined
      }
      rsvp_scheduled_game: {
        Args: { p_status: string; p_token: string }
        Returns: undefined
      }
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
      start_scheduled_game: {
        Args: { p_scheduled_game_id: string }
        Returns: string
      }
      start_session: {
        Args: { p_bar_id: string; p_name: string; p_players: Json }
        Returns: string
      }
      swap_player_accounts: {
        Args: { p_a: string; p_b: string }
        Returns: undefined
      }
      unlink_player: { Args: { p_player_id: string }; Returns: undefined }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
