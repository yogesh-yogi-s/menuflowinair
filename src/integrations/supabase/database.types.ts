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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          restaurant_name?: string | null;
        };
        Update: {
          full_name?: string | null;
          restaurant_name?: string | null;
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
        };
        Insert: {
          owner_id?: string;
          platform: string;
          status?: IntegrationStatus;
          enabled?: boolean;
          last_synced_at?: string | null;
          config?: Json;
        };
        Update: {
          platform?: string;
          status?: IntegrationStatus;
          enabled?: boolean;
          last_synced_at?: string | null;
          config?: Json;
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
    };
    Views: Record<string, never>;
    Functions: {
      has_role: { Args: { _user_id: string; _role: AppRole }; Returns: boolean };
      list_tables: { Args: Record<string, never>; Returns: { table_name: string }[] };
      get_columns: {
        Args: { _table: string };
        Returns: { column_name: string; data_type: string; is_nullable: string }[];
      };
    };
    Enums: { app_role: AppRole };
  };
}