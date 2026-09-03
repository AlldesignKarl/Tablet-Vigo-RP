// Tipos de la base de datos escritos a mano a partir de las migraciones
// en /supabase/migrations. Si cambias el esquema, actualiza este archivo
// (o genera uno con `supabase gen types typescript`).
//
// Nota: cada tabla/vista incluye `Relationships: []` porque el cliente de
// supabase-js exige esa propiedad para que el tipado estructural del
// esquema completo sea válido (GenericTable/GenericView), aunque aquí no
// declaremos relaciones explícitas para "select" anidados.

export type AppRole = 'ciudadano' | 'policia' | 'admin' | 'fundador';
export type TransactionType = 'salario' | 'compra_tienda' | 'compra_licencia' | 'pago_multa' | 'ajuste_admin';
export type FineStatus = 'pendiente' | 'pagada';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: AppRole; display_name: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database['public']['Tables']['profiles']['Row']> & { id: string };
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
        Relationships: [];
      };
      discord_links: {
        Row: {
          profile_id: string;
          discord_user_id: string | null;
          discord_username: string | null;
          avatar_url: string | null;
          linked_at: string;
        };
        Insert: Partial<Database['public']['Tables']['discord_links']['Row']> & { profile_id: string };
        Update: Partial<Database['public']['Tables']['discord_links']['Row']>;
        Relationships: [];
      };
      dnis: {
        Row: {
          id: string;
          profile_id: string;
          dni_number: string;
          first_name: string;
          last_name: string;
          birth_date: string;
          roblox_username: string;
          roblox_user_id: number;
          roblox_avatar_url: string | null;
          license_points: number;
          issued_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          first_name: string;
          last_name: string;
          birth_date: string;
          roblox_username: string;
          roblox_user_id: number;
          roblox_avatar_url?: string | null;
        };
        Update: Partial<Database['public']['Tables']['dnis']['Row']>;
        Relationships: [];
      };
      jobs: {
        Row: { id: string; code: string; name: string; salary_cents: number; created_at: string; updated_at: string };
        Insert: Partial<Database['public']['Tables']['jobs']['Row']> & { code: string; name: string };
        Update: Partial<Database['public']['Tables']['jobs']['Row']>;
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          profile_id: string;
          balance_cents: number;
          job_id: string | null;
          last_salary_payment: string | null;
          next_salary_payment: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['bank_accounts']['Row']> & { profile_id: string };
        Update: Partial<Database['public']['Tables']['bank_accounts']['Row']>;
        Relationships: [];
      };
      bank_transactions: {
        Row: {
          id: string;
          profile_id: string;
          type: TransactionType;
          amount_cents: number;
          description: string;
          reference_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['bank_transactions']['Row'], 'id' | 'created_at'>;
        Update: never;
        Relationships: [];
      };
      license_types: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          icon: string;
          price_cents: number;
          active: boolean;
          renewable: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['license_types']['Row']> & { code: string; name: string };
        Update: Partial<Database['public']['Tables']['license_types']['Row']>;
        Relationships: [];
      };
      licenses: {
        Row: { id: string; profile_id: string; license_type_id: string; acquired_at: string; active: boolean };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      shop_products: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string;
          icon: string;
          price_cents: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['shop_products']['Row']> & { code: string; name: string };
        Update: Partial<Database['public']['Tables']['shop_products']['Row']>;
        Relationships: [];
      };
      shop_purchases: {
        Row: { id: string; profile_id: string; product_id: string; price_cents: number; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          profile_id: string;
          plate: string;
          brand: string;
          model: string;
          color: string;
          insured: boolean;
          impounded: boolean;
          status: string;
          registered_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: Partial<Database['public']['Tables']['vehicles']['Row']>;
        Relationships: [];
      };
      police_users: {
        Row: {
          profile_id: string;
          callsign: string;
          rank: string;
          authorized: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['police_users']['Row']> & { profile_id: string; callsign: string };
        Update: Partial<Database['public']['Tables']['police_users']['Row']>;
        Relationships: [];
      };
      arrests: {
        Row: {
          id: string;
          citizen_id: string;
          officer_id: string;
          reason: string;
          duration_minutes: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      fines: {
        Row: {
          id: string;
          citizen_id: string;
          officer_id: string;
          reason: string;
          amount_cents: number;
          status: FineStatus;
          created_at: string;
          paid_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      confiscations: {
        Row: {
          id: string;
          citizen_id: string;
          officer_id: string;
          material: string;
          quantity: string;
          reason: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      vehicle_impounds: {
        Row: {
          id: string;
          vehicle_id: string;
          officer_id: string;
          reason: string;
          created_at: string;
          released_at: string | null;
          released_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      license_points_history: {
        Row: {
          id: string;
          citizen_id: string;
          officer_id: string;
          points_removed: number;
          points_before: number;
          points_after: number;
          reason: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      wanted_persons: {
        Row: {
          id: string;
          citizen_id: string;
          officer_id: string;
          reason: string;
          active: boolean;
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      radio_messages: {
        Row: { id: string; sender_id: string; callsign: string; channel: string; message: string; created_at: string };
        Insert: { sender_id: string; callsign: string; channel?: string; message: string };
        Update: never;
        Relationships: [];
      };
      app_config: {
        Row: { key: string; value: Record<string, unknown>; updated_at: string; updated_by: string | null };
        Insert: Partial<Database['public']['Tables']['app_config']['Row']> & { key: string; value: Record<string, unknown> };
        Update: Partial<Database['public']['Tables']['app_config']['Row']>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_label: string | null;
          action: string;
          target: string | null;
          metadata: Record<string, unknown>;
          ip: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      rate_limits: {
        Row: { key: string; count: number; window_start: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      citizen_profile_view: {
        Row: {
          profile_id: string;
          dni_id: string;
          dni_number: string;
          first_name: string;
          last_name: string;
          birth_date: string;
          roblox_username: string;
          roblox_user_id: number;
          roblox_avatar_url: string | null;
          license_points: number;
          issued_at: string;
          balance_cents: number | null;
          next_salary_payment: string | null;
          last_salary_payment: string | null;
          job_name: string | null;
          salary_cents: number | null;
          fines_count: number;
          fines_pending_amount_cents: number;
          arrests_count: number;
          vehicles_count: number;
          confiscations_count: number;
          is_wanted: boolean;
          wanted_reason: string | null;
          wanted_since: string | null;
        };
        Relationships: [];
      };
      police_stats_view: {
        Row: {
          total_citizens: number;
          total_vehicles: number;
          total_weapon_licenses: number;
          total_wanted: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      claim_salary: {
        Args: Record<string, never>;
        Returns: { paid: boolean; new_balance_cents: number; next_salary_payment: string; amount_cents: number }[];
      };
      purchase_license: {
        Args: { p_license_type_id: string };
        Returns: { success: boolean; message: string; new_balance_cents: number }[];
      };
      purchase_product: {
        Args: { p_product_id: string };
        Returns: { success: boolean; message: string; new_balance_cents: number }[];
      };
      pay_fine: {
        Args: { p_fine_id: string };
        Returns: { success: boolean; message: string; new_balance_cents: number }[];
      };
      register_vehicle: {
        Args: { p_plate: string; p_brand: string; p_model: string; p_color: string };
        Returns: { success: boolean; message: string; vehicle_id: string | null }[];
      };
      request_police_access_code: {
        Args: Record<string, never>;
        Returns: { success: boolean; message: string; code: string | null }[];
      };
      redeem_police_access_code: {
        Args: { p_code: string };
        Returns: { success: boolean; message: string }[];
      };
      police_arrest: { Args: { p_citizen_id: string; p_reason: string; p_duration_minutes: number }; Returns: string };
      police_fine: { Args: { p_citizen_id: string; p_reason: string; p_amount_cents: number }; Returns: string };
      police_confiscate: {
        Args: { p_citizen_id: string; p_material: string; p_quantity: string; p_reason: string };
        Returns: string;
      };
      police_impound_vehicle: { Args: { p_vehicle_id: string; p_reason: string }; Returns: string };
      police_release_vehicle: { Args: { p_vehicle_id: string }; Returns: undefined };
      police_remove_points: { Args: { p_citizen_id: string; p_points: number; p_reason: string }; Returns: number };
      police_set_wanted: { Args: { p_citizen_id: string; p_reason: string }; Returns: string };
      police_clear_wanted: { Args: { p_citizen_id: string }; Returns: undefined };
      is_police_authorized: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      pay_all_due_salaries: { Args: Record<string, never>; Returns: number };
      admin_set_police_code: { Args: { p_code: string }; Returns: undefined };
      admin_set_role: { Args: { p_profile_id: string; p_role: AppRole }; Returns: undefined };
      admin_adjust_balance: { Args: { p_profile_id: string; p_amount_cents: number; p_reason: string }; Returns: undefined };
      admin_set_config: { Args: { p_key: string; p_value: Record<string, unknown> }; Returns: undefined };
      check_rate_limit: { Args: { p_key: string; p_max_count: number; p_window_seconds: number }; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      transaction_type: TransactionType;
      fine_status: FineStatus;
    };
  };
}
