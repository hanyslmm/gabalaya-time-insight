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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          current_organization_id: string | null
          full_name: string | null
          id: string
          is_global_owner: boolean | null
          organization_id: string | null
          password_hash: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          current_organization_id?: string | null
          full_name?: string | null
          id?: string
          is_global_owner?: boolean | null
          organization_id?: string | null
          password_hash: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          current_organization_id?: string | null
          full_name?: string | null
          id?: string
          is_global_owner?: boolean | null
          organization_id?: string | null
          password_hash?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          name_ar: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          name_ar: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          name_ar?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          auto_clockout_enabled: boolean | null
          auto_clockout_location: string | null
          auto_clockout_time: string | null
          created_at: string
          id: number
          max_work_hours: number | null
          motivational_message: string | null
          organization_id: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          auto_clockout_enabled?: boolean | null
          auto_clockout_location?: string | null
          auto_clockout_time?: string | null
          created_at?: string
          id?: number
          max_work_hours?: number | null
          motivational_message?: string | null
          organization_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          auto_clockout_enabled?: boolean | null
          auto_clockout_location?: string | null
          auto_clockout_time?: string | null
          created_at?: string
          id?: number
          max_work_hours?: number | null
          motivational_message?: string | null
          organization_id?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          age_group: string
          created_at: string | null
          description_ar: string
          id: string
          image_url: string | null
          is_featured: boolean | null
          name_ar: string
          price: number
          start_date: string
        }
        Insert: {
          age_group: string
          created_at?: string | null
          description_ar: string
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          name_ar: string
          price: number
          start_date: string
        }
        Update: {
          age_group?: string
          created_at?: string | null
          description_ar?: string
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          name_ar?: string
          price?: number
          start_date?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          hiring_date: string
          id: string
          morning_wage_rate: number | null
          night_wage_rate: number | null
          organization_id: string | null
          phone_number: string | null
          role: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          hiring_date: string
          id?: string
          morning_wage_rate?: number | null
          night_wage_rate?: number | null
          organization_id?: string | null
          phone_number?: string | null
          role: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          hiring_date?: string
          id?: string
          morning_wage_rate?: number | null
          night_wage_rate?: number | null
          organization_id?: string | null
          phone_number?: string | null
          role?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name_ar: string
          name_en: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name_ar: string
          name_en: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name_ar?: string
          name_en?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      instructors: {
        Row: {
          bio_ar: string
          created_at: string | null
          id: string
          name_ar: string
          photo_url: string | null
        }
        Insert: {
          bio_ar: string
          created_at?: string | null
          id?: string
          name_ar: string
          photo_url?: string | null
        }
        Update: {
          bio_ar?: string
          created_at?: string | null
          id?: string
          name_ar?: string
          photo_url?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          price: number
          product_id: string | null
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          price: number
          product_id?: string | null
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          price?: number
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_address: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id: string
          notes: string | null
          status: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address: string
          customer_email: string
          customer_name: string
          customer_phone: string
          id?: string
          notes?: string | null
          status?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          notes?: string | null
          status?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
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
      owner_organization_access: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string | null
          owner_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          owner_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_organization_access_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_organization_access_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          description_ar: string | null
          featured: boolean | null
          id: string
          image_url: string | null
          images: string[] | null
          in_stock: boolean | null
          name: string
          name_ar: string
          price: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          name: string
          name_ar: string
          price: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          description_ar?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          in_stock?: boolean | null
          name?: string
          name_ar?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          child_age: number
          child_name: string
          course_id: string
          created_at: string | null
          email: string
          id: string
          parent_name: string
          phone_number: string
        }
        Insert: {
          child_age: number
          child_name: string
          course_id: string
          created_at?: string | null
          email: string
          id?: string
          parent_name: string
          phone_number: string
        }
        Update: {
          child_age?: number
          child_name?: string
          course_id?: string
          created_at?: string | null
          email?: string
          id?: string
          parent_name?: string
          phone_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          created_at: string | null
          id: string
          parent_name_ar: string
          quote_ar: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_name_ar: string
          quote_ar: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_name_ar?: string
          quote_ar?: string
        }
        Relationships: []
      }
      timesheet_entries: {
        Row: {
          actual_hours: number | null
          break_end: string | null
          break_length: number | null
          break_start: string | null
          break_type: string | null
          clock_in_date: string
          clock_in_location: string | null
          clock_in_time: string
          clock_out_date: string | null
          clock_out_location: string | null
          clock_out_time: string | null
          created_at: string
          employee_id: string | null
          employee_name: string
          employee_note: string | null
          id: string
          is_split_calculation: boolean | null
          manager_note: string | null
          morning_hours: number | null
          night_hours: number | null
          no_show_reason: string | null
          organization_id: string | null
          payroll_id: string | null
          total_card_amount_flat: number
          total_card_amount_split: number | null
          total_hours: number
          updated_at: string
        }
        Insert: {
          actual_hours?: number | null
          break_end?: string | null
          break_length?: number | null
          break_start?: string | null
          break_type?: string | null
          clock_in_date: string
          clock_in_location?: string | null
          clock_in_time: string
          clock_out_date?: string | null
          clock_out_location?: string | null
          clock_out_time?: string | null
          created_at?: string
          employee_id?: string | null
          employee_name: string
          employee_note?: string | null
          id?: string
          is_split_calculation?: boolean | null
          manager_note?: string | null
          morning_hours?: number | null
          night_hours?: number | null
          no_show_reason?: string | null
          organization_id?: string | null
          payroll_id?: string | null
          total_card_amount_flat?: number
          total_card_amount_split?: number | null
          total_hours?: number
          updated_at?: string
        }
        Update: {
          actual_hours?: number | null
          break_end?: string | null
          break_length?: number | null
          break_start?: string | null
          break_type?: string | null
          clock_in_date?: string
          clock_in_location?: string | null
          clock_in_time?: string
          clock_out_date?: string | null
          clock_out_location?: string | null
          clock_out_time?: string | null
          created_at?: string
          employee_id?: string | null
          employee_name?: string
          employee_note?: string | null
          id?: string
          is_split_calculation?: boolean | null
          manager_note?: string | null
          morning_hours?: number | null
          night_hours?: number | null
          no_show_reason?: string | null
          organization_id?: string | null
          payroll_id?: string | null
          total_card_amount_flat?: number
          total_card_amount_split?: number | null
          total_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          date: string
          description: string
          id: string
          notes: string | null
          receipt_image_url: string | null
          staff_owner: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          date?: string
          description: string
          id?: string
          notes?: string | null
          receipt_image_url?: string | null
          staff_owner?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          notes?: string | null
          receipt_image_url?: string | null
          staff_owner?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          password: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          password: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          password?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      wage_settings: {
        Row: {
          created_at: string
          default_flat_wage_rate: number
          id: string
          morning_end_time: string
          morning_start_time: string
          morning_wage_rate: number
          night_end_time: string
          night_start_time: string
          night_wage_rate: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_flat_wage_rate?: number
          id?: string
          morning_end_time?: string
          morning_start_time?: string
          morning_wage_rate?: number
          night_end_time?: string
          night_start_time?: string
          night_wage_rate?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_flat_wage_rate?: number
          id?: string
          morning_end_time?: string
          morning_start_time?: string
          morning_wage_rate?: number
          night_end_time?: string
          night_start_time?: string
          night_wage_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      employee_timesheet_summary: {
        Row: {
          full_name: string | null
          month_year: string | null
          staff_id: string | null
          total_flat_amount: number | null
          total_hours: number | null
          total_shifts: number | null
          total_split_amount: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      clock_in: {
        Args: { p_clock_in_location: string; p_staff_id: string }
        Returns: {
          actual_hours: number | null
          break_end: string | null
          break_length: number | null
          break_start: string | null
          break_type: string | null
          clock_in_date: string
          clock_in_location: string | null
          clock_in_time: string
          clock_out_date: string | null
          clock_out_location: string | null
          clock_out_time: string | null
          created_at: string
          employee_id: string | null
          employee_name: string
          employee_note: string | null
          id: string
          is_split_calculation: boolean | null
          manager_note: string | null
          morning_hours: number | null
          night_hours: number | null
          no_show_reason: string | null
          organization_id: string | null
          payroll_id: string | null
          total_card_amount_flat: number
          total_card_amount_split: number | null
          total_hours: number
          updated_at: string
        }
      }
      clock_out: {
        Args: { p_clock_out_location: string; p_entry_id: string }
        Returns: {
          actual_hours: number | null
          break_end: string | null
          break_length: number | null
          break_start: string | null
          break_type: string | null
          clock_in_date: string
          clock_in_location: string | null
          clock_in_time: string
          clock_out_date: string | null
          clock_out_location: string | null
          clock_out_time: string | null
          created_at: string
          employee_id: string | null
          employee_name: string
          employee_note: string | null
          id: string
          is_split_calculation: boolean | null
          manager_note: string | null
          morning_hours: number | null
          night_hours: number | null
          no_show_reason: string | null
          organization_id: string | null
          payroll_id: string | null
          total_card_amount_flat: number
          total_card_amount_split: number | null
          total_hours: number
          updated_at: string
        }
      }
      get_current_user_info: {
        Args: Record<PropertyKey, never>
        Returns: {
          organization_id: string
          role: string
          user_id: string
          username: string
        }[]
      }
      get_current_user_organization: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user_role_safe: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_dashboard_stats: {
        Args: { from_date: string; to_date: string }
        Returns: Json
      }
      get_monthly_summary: {
        Args: { target_month: number; target_year: number }
        Returns: {
          net_profit: number
          total_expense: number
          total_income: number
          transaction_count: number
        }[]
      }
      get_user_role: {
        Args: { user_username: string }
        Returns: string
      }
      is_current_user_owner: {
        Args: Record<PropertyKey, never>
        Returns: boolean
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
