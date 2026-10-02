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
    PostgrestVersion: "14.18"
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
      daily_alerts: {
        Row: {
          alert_at: string
          local_date: string
          sent_at: string | null
        }
        Insert: {
          alert_at: string
          local_date: string
          sent_at?: string | null
        }
        Update: {
          alert_at?: string
          local_date?: string
          sent_at?: string | null
        }
        Relationships: []
      }
      garden_members: {
        Row: {
          garden_id: string
          joined_at: string
          petal_order: number
          user_id: string
        }
        Insert: {
          garden_id: string
          joined_at?: string
          petal_order: number
          user_id: string
        }
        Update: {
          garden_id?: string
          joined_at?: string
          petal_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "garden_members_garden_id_fkey"
            columns: ["garden_id"]
            isOneToOne: false
            referencedRelation: "gardens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "garden_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gardens: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          invite_code: string | null
          kind: string
          max_members: number
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string | null
          kind: string
          max_members?: number
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          invite_code?: string | null
          kind?: string
          max_members?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "gardens_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plantings: {
        Row: {
          garden_id: string
          local_date: string
          sky_photo_id: string
        }
        Insert: {
          garden_id: string
          local_date: string
          sky_photo_id: string
        }
        Update: {
          garden_id?: string
          local_date?: string
          sky_photo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantings_garden_id_fkey"
            columns: ["garden_id"]
            isOneToOne: false
            referencedRelation: "gardens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_sky_photo_id_fkey"
            columns: ["sky_photo_id"]
            isOneToOne: false
            referencedRelation: "sky_photos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nickname: string
          notify: boolean
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          nickname: string
          notify?: boolean
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nickname?: string
          notify?: boolean
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sky_photos: {
        Row: {
          dominant_color: string
          id: string
          image_path: string
          local_date: string
          note: string | null
          taken_at: string
          user_id: string
        }
        Insert: {
          dominant_color: string
          id?: string
          image_path: string
          local_date: string
          note?: string | null
          taken_at: string
          user_id: string
        }
        Update: {
          dominant_color?: string
          id?: string
          image_path?: string
          local_date?: string
          note?: string | null
          taken_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sky_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_member_of_all: {
        Args: { p_garden_ids: string[] }
        Returns: undefined
      }
      can_see_photo: { Args: { p: string }; Returns: boolean }
      create_garden: {
        Args: { p_max_members: number; p_name: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          invite_code: string | null
          kind: string
          max_members: number
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "gardens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_sky: { Args: { p_photo: string }; Returns: string }
      gen_invite_code: { Args: never; Returns: string }
      get_month: {
        Args: { p_garden: string; p_month: string }
        Returns: {
          dominant_color: string
          local_date: string
          user_id: string
        }[]
      }
      is_member: { Args: { g: string }; Returns: boolean }
      join_garden: {
        Args: { p_code: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          invite_code: string | null
          kind: string
          max_members: number
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "gardens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_garden: { Args: { p_garden: string }; Returns: undefined }
      own_photo: {
        Args: { p_photo: string }
        Returns: {
          dominant_color: string
          id: string
          image_path: string
          local_date: string
          note: string | null
          taken_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "sky_photos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      plant_sky: {
        Args: {
          p_color: string
          p_garden_ids: string[]
          p_image_path: string
          p_note: string
        }
        Returns: {
          old_image_path: string
          photo_id: string
        }[]
      }
      renumber_petals: { Args: { p_garden: string }; Returns: undefined }
      reorder_petals: {
        Args: { p_garden: string; p_user_ids: string[] }
        Returns: undefined
      }
      seoul_today: { Args: never; Returns: string }
      set_plantings: {
        Args: { p_garden_ids: string[]; p_photo: string }
        Returns: undefined
      }
      shares_garden: { Args: { other: string }; Returns: boolean }
      sync_plantings: {
        Args: { p_date: string; p_garden_ids: string[]; p_photo: string }
        Returns: undefined
      }
      unplant: {
        Args: { p_garden: string; p_photo: string }
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
