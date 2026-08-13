/**
 * Hand-authored from DATABASE_SCHEMA.md + supabase migrations (read-only).
 * Regenerate when linked: `npm run db:types`
 * Do not edit files under /supabase from the Next.js app.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: "Admin" | "Manager" | "Staff";
          status: "Active" | "Inactive";
          is_deleted: boolean;
          created_at: string | null;
          updated_at: string | null;
          created_by: string | null;
          company_id: string;
        };
        Insert: {
          id: string;
          full_name: string;
          email: string;
          phone?: string | null;
          role: "Admin" | "Manager" | "Staff";
          status?: "Active" | "Inactive";
          is_deleted?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
          created_by?: string | null;
          company_id: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          phone?: string | null;
          role?: "Admin" | "Manager" | "Staff";
          status?: "Active" | "Inactive";
          created_at?: string | null;
          updated_at?: string | null;
          created_by?: string | null;
          company_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      user_permissions: {
        Row: {
          id: string;
          user_id: string;
          permission: "stock_in" | "stock_out";
          granted: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          permission: "stock_in" | "stock_out";
          granted?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          permission?: "stock_in" | "stock_out";
          granted?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_permissions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      companies: {
        Row: {
          id: string;
          business_name: string;
          logo_url: string | null;
          phone: string | null;
          address: string | null;
          gstin: string | null;
          invoice_prefix: string;
          receipt_footer: string | null;
          show_logo_on_bill: boolean;
          owner_email: string | null;
          owner_name: string | null;
          business_category: string | null;
          /** Auto barcode counter. 0 means next code is 0001. */
          product_barcode_seq: number;
          is_active: boolean;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_name: string;
          logo_url?: string | null;
          phone?: string | null;
          address?: string | null;
          gstin?: string | null;
          invoice_prefix?: string;
          receipt_footer?: string | null;
          show_logo_on_bill?: boolean;
          owner_email?: string | null;
          owner_name?: string | null;
          business_category?: string | null;
          product_barcode_seq?: number;
          is_active?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string;
          logo_url?: string | null;
          phone?: string | null;
          address?: string | null;
          gstin?: string | null;
          invoice_prefix?: string;
          receipt_footer?: string | null;
          show_logo_on_bill?: boolean;
          owner_email?: string | null;
          owner_name?: string | null;
          business_category?: string | null;
          product_barcode_seq?: number;
          is_active?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_categories: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      accounting_categories: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          type: "income" | "expense";
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          type: "income" | "expense";
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          type?: "income" | "expense";
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "accounting_categories_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      taxes: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          percentage: number;
          is_active: boolean;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          percentage: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          percentage?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "taxes_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          barcode: string | null;
          purchase_price: number | null;
          selling_price: number | null;
          mrp: number | null;
          unit: string | null;
          low_stock_alert_qty: number;
          is_active: boolean;
          is_deleted: boolean;
          created_at: string;
          updated_at: string | null;
          product_category_id: string | null;
          stock_quantity: number;
          image_url: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          barcode?: string | null;
          purchase_price?: number | null;
          selling_price?: number | null;
          mrp?: number | null;
          unit?: string | null;
          low_stock_alert_qty?: number;
          is_active?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string | null;
          product_category_id?: string | null;
          stock_quantity?: number;
          image_url?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          barcode?: string | null;
          purchase_price?: number | null;
          selling_price?: number | null;
          mrp?: number | null;
          unit?: string | null;
          low_stock_alert_qty?: number;
          is_active?: boolean;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string | null;
          product_category_id?: string | null;
          stock_quantity?: number;
          image_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_product_category_id_fkey";
            columns: ["product_category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_batches: {
        Row: {
          id: string;
          company_id: string;
          product_id: string;
          batch_seq: number;
          name: string | null;
          purchase_price: number;
          selling_price: number | null;
          mrp: number | null;
          quantity_received: number;
          quantity_remaining: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          product_id: string;
          batch_seq: number;
          name?: string | null;
          purchase_price: number;
          selling_price?: number | null;
          mrp?: number | null;
          quantity_received?: number;
          quantity_remaining?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          product_id?: string;
          batch_seq?: number;
          name?: string | null;
          purchase_price?: number;
          selling_price?: number | null;
          mrp?: number | null;
          quantity_received?: number;
          quantity_remaining?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          id: string;
          company_id: string;
          supplier_name: string;
          contact_person: string | null;
          phone: string | null;
          email: string | null;
          address: string | null;
          gst_number: string | null;
          opening_balance: number | null;
          created_at: string | null;
          updated_at: string | null;
          is_deleted: boolean | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          supplier_name: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          gst_number?: string | null;
          opening_balance?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          is_deleted?: boolean | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          supplier_name?: string;
          contact_person?: string | null;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          gst_number?: string | null;
          opening_balance?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
          is_deleted?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          phone: string;
          email: string | null;
          address: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          phone: string;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          phone?: string;
          email?: string | null;
          address?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      accounts: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          description: string | null;
          opening_balance: number | null;
          current_balance: number;
          is_default: boolean;
          is_active: boolean;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          description?: string | null;
          opening_balance?: number | null;
          current_balance?: number;
          is_default?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          description?: string | null;
          opening_balance?: number | null;
          current_balance?: number;
          is_default?: boolean;
          is_active?: boolean;
          created_by?: string | null;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      entries: {
        Row: {
          id: string;
          company_id: string;
          entry_type: "income" | "expense";
          account_id: string;
          category_id: string;
          amount: number;
          entry_date: string;
          remarks: string | null;
          source_type:
            | "bill"
            | "bill_return"
            | "purchase"
            | "manual"
            | "bill_payment"
            | null;
          source_id: string | null;
          is_deleted: boolean;
          payment_mode: "Cash" | "UPI" | "Card" | "Mixed" | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          entry_type: "income" | "expense";
          account_id: string;
          category_id: string;
          amount: number;
          entry_date: string;
          remarks?: string | null;
          source_type?:
            | "bill"
            | "bill_return"
            | "purchase"
            | "manual"
            | "bill_payment"
            | null;
          source_id?: string | null;
          is_deleted?: boolean;
          payment_mode?: "Cash" | "UPI" | "Card" | "Mixed" | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          entry_type?: "income" | "expense";
          account_id?: string;
          category_id?: string;
          amount?: number;
          entry_date?: string;
          remarks?: string | null;
          source_type?:
            | "bill"
            | "bill_return"
            | "purchase"
            | "manual"
            | "bill_payment"
            | null;
          source_id?: string | null;
          is_deleted?: boolean;
          payment_mode?: "Cash" | "UPI" | "Card" | "Mixed" | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_in: {
        Row: {
          id: string;
          company_id: string;
          date: string;
          supplier_id: string | null;
          invoice_number: string | null;
          notes: string | null;
          total_items: number;
          total_amount: number;
          account_id: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          date: string;
          supplier_id?: string | null;
          invoice_number?: string | null;
          notes?: string | null;
          total_items?: number;
          total_amount?: number;
          account_id: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          date?: string;
          supplier_id?: string | null;
          invoice_number?: string | null;
          notes?: string | null;
          total_items?: number;
          total_amount?: number;
          account_id?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_in_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_in_items: {
        Row: {
          id: string;
          company_id: string;
          stock_in_id: string;
          product_id: string;
          manufacturing_date: string | null;
          purchase_price: number;
          selling_price: number | null;
          mrp: number | null;
          quantity: number;
          row_total: number;
          batch_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          stock_in_id: string;
          product_id: string;
          manufacturing_date?: string | null;
          purchase_price: number;
          selling_price?: number | null;
          mrp?: number | null;
          quantity: number;
          row_total: number;
          batch_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          stock_in_id?: string;
          product_id?: string;
          manufacturing_date?: string | null;
          purchase_price?: number;
          selling_price?: number | null;
          mrp?: number | null;
          quantity?: number;
          row_total?: number;
          batch_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_in_items_stock_in_id_fkey";
            columns: ["stock_in_id"];
            isOneToOne: false;
            referencedRelation: "stock_in";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_transactions: {
        Row: {
          id: string;
          product_id: string;
          transaction_type: string;
          quantity: number;
          reference_type: string;
          reference_id: string;
          notes: string | null;
          created_at: string;
          company_id: string;
          batch_id: string | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          transaction_type: string;
          quantity: number;
          reference_type: string;
          reference_id: string;
          notes?: string | null;
          created_at?: string;
          company_id: string;
          batch_id?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          transaction_type?: string;
          quantity?: number;
          reference_type?: string;
          reference_id?: string;
          notes?: string | null;
          created_at?: string;
          company_id?: string;
          batch_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_transactions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      bills: {
        Row: {
          id: string;
          company_id: string;
          bill_number: string | null;
          customer_id: string | null;
          subtotal_amount: number;
          other_items_amount: number;
          discount_type: "AMOUNT" | "PERCENT" | null;
          discount_value: number | null;
          discount_amount: number;
          total_payable_amount: number;
          payment_mode: "Cash" | "UPI" | "Card" | "Mixed";
          cash_amount: number;
          online_amount: number;
          received_amount_total: number;
          status:
            | "PENDING"
            | "PARTIALLY_PAID"
            | "PAID"
            | "RETURNED"
            | "PARTIAL_RETURN";
          return_note: string | null;
          returned_at: string | null;
          created_by_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          bill_number?: string | null;
          customer_id?: string | null;
          subtotal_amount?: number;
          other_items_amount?: number;
          discount_type?: "AMOUNT" | "PERCENT" | null;
          discount_value?: number | null;
          discount_amount?: number;
          total_payable_amount?: number;
          payment_mode: "Cash" | "UPI" | "Card" | "Mixed";
          cash_amount?: number;
          online_amount?: number;
          received_amount_total?: number;
          status?:
            | "PENDING"
            | "PARTIALLY_PAID"
            | "PAID"
            | "RETURNED"
            | "PARTIAL_RETURN";
          return_note?: string | null;
          returned_at?: string | null;
          created_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          bill_number?: string | null;
          customer_id?: string | null;
          subtotal_amount?: number;
          other_items_amount?: number;
          discount_type?: "AMOUNT" | "PERCENT" | null;
          discount_value?: number | null;
          discount_amount?: number;
          total_payable_amount?: number;
          payment_mode?: "Cash" | "UPI" | "Card" | "Mixed";
          cash_amount?: number;
          online_amount?: number;
          received_amount_total?: number;
          status?:
            | "PENDING"
            | "PARTIALLY_PAID"
            | "PAID"
            | "RETURNED"
            | "PARTIAL_RETURN";
          return_note?: string | null;
          returned_at?: string | null;
          created_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bills_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      bill_items: {
        Row: {
          id: string;
          company_id: string;
          bill_id: string;
          product_id: string | null;
          product_name: string;
          barcode: string | null;
          unit_price: number;
          quantity: number;
          row_total: number;
          batch_id: string | null;
          unit_cost: number | null;
          mrp: number | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          bill_id: string;
          product_id?: string | null;
          product_name: string;
          barcode?: string | null;
          unit_price: number;
          quantity: number;
          row_total: number;
          batch_id?: string | null;
          unit_cost?: number | null;
          mrp?: number | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          bill_id?: string;
          product_id?: string | null;
          product_name?: string;
          barcode?: string | null;
          unit_price?: number;
          quantity?: number;
          row_total?: number;
          batch_id?: string | null;
          unit_cost?: number | null;
          mrp?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
        ];
      };
      bill_returns: {
        Row: {
          id: string;
          company_id: string;
          bill_id: string;
          return_number: string;
          return_note: string | null;
          total_return_amount: number;
          refund_method: "Cash" | "UPI" | "Card" | "Mixed";
          refund_status: "pending" | "refunded";
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          bill_id: string;
          return_number: string;
          return_note?: string | null;
          total_return_amount: number;
          refund_method?: "Cash" | "UPI" | "Card" | "Mixed";
          refund_status?: "pending" | "refunded";
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          bill_id?: string;
          return_number?: string;
          return_note?: string | null;
          total_return_amount?: number;
          refund_method?: "Cash" | "UPI" | "Card" | "Mixed";
          refund_status?: "pending" | "refunded";
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bill_returns_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "bills";
            referencedColumns: ["id"];
          },
        ];
      };
      bill_return_items: {
        Row: {
          id: string;
          company_id: string;
          return_id: string;
          bill_item_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          batch_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          return_id: string;
          bill_item_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          line_total: number;
          batch_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          return_id?: string;
          bill_item_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          line_total?: number;
          batch_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bill_return_items_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "bill_returns";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_log: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          user_name: string;
          action_type: "Create" | "Update" | "Delete" | "Login" | "Logout";
          module_name: string;
          record_id: string | null;
          description: string;
          status: "Success" | "Failed";
          ip_address: string | null;
          old_values: Json | null;
          new_values: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          user_name: string;
          action_type: "Create" | "Update" | "Delete" | "Login" | "Logout";
          module_name: string;
          record_id?: string | null;
          description: string;
          status: "Success" | "Failed";
          ip_address?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          user_name?: string;
          action_type?: "Create" | "Update" | "Delete" | "Login" | "Logout";
          module_name?: string;
          record_id?: string | null;
          description?: string;
          status?: "Success" | "Failed";
          ip_address?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      super_admins: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          status: "Active" | "Inactive";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          status?: "Active" | "Inactive";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          status?: "Active" | "Inactive";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          business_name: string | null;
          contact_name: string | null;
          email: string;
          phone: string | null;
          message: string | null;
          status:
            | "New"
            | "Contacted"
            | "Interested"
            | "Approved"
            | "Not Interested";
          converted_company_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_name?: string | null;
          contact_name?: string | null;
          email: string;
          phone?: string | null;
          message?: string | null;
          status?:
            | "New"
            | "Contacted"
            | "Interested"
            | "Approved"
            | "Not Interested";
          converted_company_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string | null;
          contact_name?: string | null;
          email?: string;
          phone?: string | null;
          message?: string | null;
          status?:
            | "New"
            | "Contacted"
            | "Interested"
            | "Approved"
            | "Not Interested";
          converted_company_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      bill_history_sales_view: {
        Row: {
          id: string;
          bill_number: string | null;
          customer_name: string;
          customer_phone: string;
          created_by_name: string;
          created_at: string;
          total_payable_amount: number;
          payment_mode: "Cash" | "UPI" | "Card" | "Mixed";
          status:
            | "PENDING"
            | "PARTIALLY_PAID"
            | "PAID"
            | "RETURNED"
            | "PARTIAL_RETURN";
        };
        Relationships: [];
      };
      stock_in_list_view: {
        Row: {
          id: string;
          date: string;
          invoice_number: string | null;
          notes: string | null;
          total_items: number;
          total_amount: number;
          supplier_name: string;
          created_by_name: string | null;
          created_at: string;
        };
        Relationships: [];
      };
      user_list_with_permissions_view: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          role: "Admin" | "Manager" | "Staff";
          status: "Active" | "Inactive";
          created_at: string;
          updated_at: string;
          created_by: string | null;
          permissions: string[];
          company_id: string;
          is_deleted: boolean;
        };
        Relationships: [];
      };
      transactions_list_view: {
        Row: {
          id: string;
          entry_date: string;
          entry_type: "income" | "expense";
          account_id: string;
          account_name: string;
          category_name: string;
          amount: number;
          remarks: string | null;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_my_company_id: { Args: Record<string, never>; Returns: string };
      get_my_role: { Args: Record<string, never>; Returns: string };
      has_granted_permission: {
        Args: { p_perm: Database["public"]["Enums"]["permission_type"] };
        Returns: boolean;
      };
      restore_user: { Args: { p_user_id: string }; Returns: Json };
      allocate_next_product_barcode: {
        Args: { p_company_id?: string | null };
        Returns: string;
      };
      create_product_with_opening_stock: {
        Args: {
          p_name: string;
          p_barcode: string | null;
          p_purchase_price: number | null;
          p_selling_price: number | null;
          p_mrp: number | null;
          p_unit: string | null;
          p_low_stock_alert_qty?: number;
          p_product_category_id?: string | null;
          p_opening_stock?: number;
          p_id?: string | null;
          p_is_active?: boolean;
          p_created_by?: string | null;
          p_account_id?: string | null;
          p_image_url?: string | null;
        };
        Returns: { id: string }[];
      };
      get_product_details: {
        Args: { p_product_id: string };
        Returns: Json;
      };
      get_product_batches_with_stock: {
        Args: { p_product_id: string };
        Returns: {
          id: string;
          batch_seq: number;
          name: string;
          purchase_price: number;
          selling_price: number | null;
          mrp: number | null;
          quantity_remaining: number;
        }[];
      };
      create_stock_in: {
        Args: {
          p_date: string;
          p_items: Json;
          p_supplier_id?: string | null;
          p_invoice_number?: string | null;
          p_notes?: string | null;
          p_created_by?: string | null;
          p_account_id?: string | null;
        };
        Returns: { id: string }[];
      };
      get_manual_bill_product_id: {
        Args: Record<string, never>;
        Returns: { id: string }[];
      };
      get_transactions_totals: {
        Args: Record<string, never>;
        Returns: {
          total_entries_count: number;
          total_income: number;
          total_expense: number;
        }[];
      };
      get_admin_dashboard_totals: {
        Args: {
          p_start: string;
          p_end: string;
          p_today: string;
        };
        Returns: {
          today_sales: number;
          today_manual_income: number;
          today_purchase: number;
          today_manual_expense: number;
          today_profit: number;
          bill_count: number;
          today_returns_count: number;
          today_return_amount: number;
          cash_total: number;
          upi_total: number;
          card_total: number;
          total_products: number;
          low_stock_count: number;
          out_of_stock_count: number;
          inactive_product_count: number;
          out_of_stock_products: Json;
          today_sales_revenue: number;
          today_cogs: number;
          today_sales_profit: number;
          today_sales_profit_margin: number;
        }[];
      };
      get_sales_analytics_summary: {
        Args: {
          p_start: string;
          p_end: string;
          p_bucket?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      permission_type: "stock_in" | "stock_out";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
