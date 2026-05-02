// Hand-written DB types matching the SQL migration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type AppRole = "admin" | "owner" | "staff";
export type IntegrationStatus = "connected" | "syncing" | "error" | "disconnected";
export type SyncStatus = "success" | "error" | "pending";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          restaurant_name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          slug: string | null;
          tagline: string | null;
          preferences: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          restaurant_name?: string | null;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          slug?: string | null;
          tagline?: string | null;
          preferences?: Json;
        };
        Update: {
          full_name?: string | null;
          restaurant_name?: string | null;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          slug?: string | null;
          tagline?: string | null;
          preferences?: Json;
        };
        Relationships: [];
      };
      user_roles: {
        Row: { id: string; user_id: string; role: AppRole; created_at: string };
        Insert: { user_id: string; role: AppRole };
        Update: { role?: AppRole };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          sort_order: number;
          created_at: string;
        };
        Insert: { owner_id?: string; name: string; sort_order?: number };
        Update: { name?: string; sort_order?: number };
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          owner_id: string;
          category_id: string | null;
          name: string;
          description: string | null;
          price: number;
          available: boolean;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          owner_id?: string;
          category_id?: string | null;
          name: string;
          description?: string | null;
          price: number;
          available?: boolean;
          image_url?: string | null;
        };
        Update: {
          category_id?: string | null;
          name?: string;
          description?: string | null;
          price?: number;
          available?: boolean;
          image_url?: string | null;
        };
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          owner_id: string;
          platform: string;
          status: IntegrationStatus;
          enabled: boolean;
          last_synced_at: string | null;
          config: Json;
          created_at: string;
          last_sync_status: string | null;
          last_sync_message: string | null;
          external_store_id: string | null;
        };
        Insert: {
          owner_id?: string;
          platform: string;
          status?: IntegrationStatus;
          enabled?: boolean;
          last_synced_at?: string | null;
          config?: Json;
          last_sync_status?: string | null;
          last_sync_message?: string | null;
          external_store_id?: string | null;
        };
        Update: {
          platform?: string;
          status?: IntegrationStatus;
          enabled?: boolean;
          last_synced_at?: string | null;
          config?: Json;
          last_sync_status?: string | null;
          last_sync_message?: string | null;
          external_store_id?: string | null;
        };
        Relationships: [];
      };
      sync_logs: {
        Row: {
          id: string;
          owner_id: string;
          integration_id: string | null;
          status: SyncStatus;
          message: string | null;
          created_at: string;
        };
        Insert: {
          owner_id?: string;
          integration_id?: string | null;
          status: SyncStatus;
          message?: string | null;
        };
        Update: {
          status?: SyncStatus;
          message?: string | null;
        };
        Relationships: [];
      };
      platform_orders: {
        Row: {
          id: string;
          owner_id: string;
          integration_id: string;
          platform: string;
          external_order_id: string;
          status: string;
          customer_name: string | null;
          total: number;
          items: Json;
          placed_at: string;
          created_at: string;
          status_reason: string | null;
          accepted_at: string | null;
          ready_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          owner_id?: string;
          integration_id: string;
          platform: string;
          external_order_id: string;
          status?: string;
          customer_name?: string | null;
          total?: number;
          items?: Json;
          placed_at?: string;
          status_reason?: string | null;
          accepted_at?: string | null;
          ready_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          status?: string;
          customer_name?: string | null;
          total?: number;
          items?: Json;
          status_reason?: string | null;
          accepted_at?: string | null;
          ready_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      menu_item_availability: {
        Row: {
          id: string;
          owner_id: string;
          menu_item_id: string;
          integration_id: string;
          available: boolean;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          owner_id?: string;
          menu_item_id: string;
          integration_id: string;
          available?: boolean;
        };
        Update: {
          available?: boolean;
        };
        Relationships: [];
      };
      order_status_events: {
        Row: {
          id: string;
          owner_id: string;
          order_id: string;
          from_status: string | null;
          to_status: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          owner_id?: string;
          order_id: string;
          from_status?: string | null;
          to_status: string;
          reason?: string | null;
        };
        Update: { reason?: string | null };
        Relationships: [];
      };
    };
    Views: {
      v_orders_daily: {
        Row: {
          owner_id: string;
          platform: string;
          day: string;
          orders: number;
          revenue: number;
        };
        Relationships: [];
      };
      v_top_items: {
        Row: {
          owner_id: string;
          name: string;
          qty: number;
          revenue: number;
          last_ordered_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      list_tables: { Args: Record<string, never>; Returns: { table_name: string }[] };
      get_columns: {
        Args: { _table: string };
        Returns: { column_name: string; data_type: string; is_nullable: string }[];
      };
      get_public_menu: { Args: { _slug: string }; Returns: Json };
    };
    Enums: { app_role: AppRole };
  };
}