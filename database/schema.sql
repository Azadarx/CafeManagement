-- ============================================
-- CAFE MANAGEMENT DATABASE SCHEMA
-- ============================================
-- This schema includes all tables and RLS policies
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. SUPPLIERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  total_purchases DECIMAL(10, 2) DEFAULT 0,
  total_paid DECIMAL(10, 2) DEFAULT 0,
  balance DECIMAL(10, 2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. PURCHASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) DEFAULT 0,
  pending_amount DECIMAL(10, 2) DEFAULT 0,
  payment_status VARCHAR(20) DEFAULT 'pending', -- pending, partial, paid
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. INVENTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- e.g., vegetables, dairy, spices, etc.
  stock_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL, -- kg, liter, pieces, etc.
  minimum_stock DECIMAL(10, 2) DEFAULT 0,
  last_purchase_date DATE,
  last_purchase_price DECIMAL(10, 2),
  wastage DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. MENU ITEMS TABLE (Menu & Costing)
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- beverages, food, snacks
  selling_price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  profit_margin DECIMAL(10, 2) GENERATED ALWAYS AS (selling_price - cost_price) STORED,
  profit_percentage DECIMAL(5, 2) GENERATED ALWAYS AS (
    CASE 
      WHEN cost_price > 0 THEN ((selling_price - cost_price) / cost_price * 100)
      ELSE 0 
    END
  ) STORED,
  is_available BOOLEAN DEFAULT true,
  ingredients TEXT, -- JSON or text description
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. SALES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date DATE NOT NULL,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL, -- denormalized for history
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'cash', -- cash, card, upi
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. TRANSACTIONS TABLE (Daily Hisab)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- income, expense
  category VARCHAR(100) NOT NULL, -- sales, purchase, salary, rent, electricity, etc.
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'cash',
  reference_id UUID, -- can reference purchases, sales, etc.
  reference_type VARCHAR(50), -- purchase, sale, salary, etc.
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. STAFF TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  position VARCHAR(100),
  salary DECIMAL(10, 2) NOT NULL,
  joining_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  address TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. ATTENDANCE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL, -- present, absent, half-day, leave
  check_in_time TIME,
  check_out_time TIME,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(staff_id, attendance_date)
);

-- ============================================
-- 9. SALARY PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS salary_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  payment_date DATE NOT NULL,
  month VARCHAR(7) NOT NULL, -- YYYY-MM format
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(20) DEFAULT 'salary', -- salary, advance, bonus
  payment_method VARCHAR(50) DEFAULT 'cash',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================
-- Enable RLS on all tables
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - Users can only access their own data
-- ============================================

-- Suppliers policies
CREATE POLICY "Users can view their own suppliers"
  ON suppliers FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own suppliers"
  ON suppliers FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own suppliers"
  ON suppliers FOR DELETE
  USING (auth.uid() = created_by);

-- Purchases policies
CREATE POLICY "Users can view their own purchases"
  ON purchases FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own purchases"
  ON purchases FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own purchases"
  ON purchases FOR DELETE
  USING (auth.uid() = created_by);

-- Inventory policies
CREATE POLICY "Users can view their own inventory"
  ON inventory FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own inventory"
  ON inventory FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own inventory"
  ON inventory FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own inventory"
  ON inventory FOR DELETE
  USING (auth.uid() = created_by);

-- Menu items policies
CREATE POLICY "Users can view their own menu items"
  ON menu_items FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own menu items"
  ON menu_items FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own menu items"
  ON menu_items FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own menu items"
  ON menu_items FOR DELETE
  USING (auth.uid() = created_by);

-- Sales policies
CREATE POLICY "Users can view their own sales"
  ON sales FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own sales"
  ON sales FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own sales"
  ON sales FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own sales"
  ON sales FOR DELETE
  USING (auth.uid() = created_by);

-- Transactions policies
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  USING (auth.uid() = created_by);

-- Staff policies
CREATE POLICY "Users can view their own staff"
  ON staff FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own staff"
  ON staff FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own staff"
  ON staff FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own staff"
  ON staff FOR DELETE
  USING (auth.uid() = created_by);

-- Attendance policies
CREATE POLICY "Users can view their own attendance"
  ON attendance FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own attendance"
  ON attendance FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own attendance"
  ON attendance FOR DELETE
  USING (auth.uid() = created_by);

-- Salary payments policies
CREATE POLICY "Users can view their own salary payments"
  ON salary_payments FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert their own salary payments"
  ON salary_payments FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own salary payments"
  ON salary_payments FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own salary payments"
  ON salary_payments FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================
-- INDEXES for better performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_menu_item ON sales(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_staff ON salary_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON salary_payments(month);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- All tables and policies created successfully!
