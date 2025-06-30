export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_monthly_summary: {
        Args: { target_year: number; target_month: number }
        Returns: {
          total_income: number
          total_expense: number
          net_profit: number
          transaction_count: number
        }[]
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
