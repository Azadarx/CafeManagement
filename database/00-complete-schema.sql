-- ============================================
-- CAFE MANAGEMENT DATABASE - COMPLETE SCHEMA
-- ============================================
-- Single consolidated schema file
-- Execute this in Supabase SQL Editor
-- Version: 2.0 (Consolidated with Inventory Automation)
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
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. INVENTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  stock_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL,
  minimum_stock DECIMAL(10, 2) DEFAULT 0,
  last_purchase_date DATE,
  last_purchase_price DECIMAL(10, 2),
  wastage DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_positive_stock CHECK (stock_quantity >= 0)
);

-- ============================================
-- 3. STOCK MOVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
  movement_date DATE NOT NULL,
  movement_type VARCHAR(50) NOT NULL, -- 'purchase', 'sale', 'adjustment_in', 'adjustment_out', 'wastage'
  quantity DECIMAL(10, 2) NOT NULL, -- positive for IN, negative for OUT
  reference_type VARCHAR(50), -- 'purchase', 'sale', 'manual', 'wastage'
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. PURCHASES TABLE
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
-- 5. MENU ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
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
  ingredients TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. MENU ITEM RECIPES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS menu_item_recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
  quantity_per_serving DECIMAL(10, 4) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(menu_item_id, inventory_id)
);

-- ============================================
-- 7. SALES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_date DATE NOT NULL,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  inventory_item_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'Cash',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. TRANSACTIONS TABLE (Daily Hisab)
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL, -- income, expense
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'Cash',
  reference_id UUID,
  reference_type VARCHAR(50),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 9. STAFF TABLE
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
-- 10. ATTENDANCE TABLE
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
-- 11. SALARY PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS salary_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE NOT NULL,
  payment_date DATE NOT NULL,
  month VARCHAR(7) NOT NULL, -- YYYY-MM format
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(20) DEFAULT 'salary', -- salary, advance, bonus
  payment_method VARCHAR(50) DEFAULT 'Cash',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_supplier ON purchases(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_menu_item ON sales(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_inventory ON sales(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_staff ON attendance(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_staff ON salary_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON salary_payments(month);
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory ON stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_id, reference_type);
CREATE INDEX IF NOT EXISTS idx_recipes_menu_item ON menu_item_recipes(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_recipes_inventory ON menu_item_recipes(inventory_id);

-- Unique index to prevent duplicate purchase links
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_unique_purchase_link
ON stock_movements(reference_id, reference_type)
WHERE reference_type = 'purchase';

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_item_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Suppliers
CREATE POLICY IF NOT EXISTS "Users can view their own suppliers" ON suppliers FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own suppliers" ON suppliers FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can update their own suppliers" ON suppliers FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own suppliers" ON suppliers FOR DELETE USING (auth.uid() = created_by);

-- Purchases
CREATE POLICY IF NOT EXISTS "Users can view their own purchases" ON purchases FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own purchases" ON purchases FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can update their own purchases" ON purchases FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own purchases" ON purchases FOR DELETE USING (auth.uid() = created_by);

-- Inventory
CREATE POLICY IF NOT EXISTS "Users can view their own inventory" ON inventory FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own inventory" ON inventory FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can update their own inventory" ON inventory FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own inventory" ON inventory FOR DELETE USING (auth.uid() = created_by);

-- Menu items
CREATE POLICY IF NOT EXISTS "Users can view their own menu items" ON menu_items FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own menu items" ON menu_items FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can update their own menu items" ON menu_items FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own menu items" ON menu_items FOR DELETE USING (auth.uid() = created_by);

-- Menu item recipes (shared access for authenticated users)
CREATE POLICY IF NOT EXISTS "Authenticated users can view all recipes" ON menu_item_recipes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated users can insert recipes" ON menu_item_recipes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated users can update all recipes" ON menu_item_recipes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Authenticated users can delete all recipes" ON menu_item_recipes FOR DELETE USING (auth.role() = 'authenticated');

-- Sales
CREATE POLICY IF NOT EXISTS "Users can view their own sales" ON sales FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own sales" ON sales FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can update their own sales" ON sales FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own sales" ON sales FOR DELETE USING (auth.uid() = created_by);

-- Transactions
CREATE POLICY IF NOT EXISTS "Users can view their own transactions" ON transactions FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can update their own transactions" ON transactions FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own transactions" ON transactions FOR DELETE USING (auth.uid() = created_by);

-- Staff
CREATE POLICY IF NOT EXISTS "Users can view their own staff" ON staff FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own staff" ON staff FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can update their own staff" ON staff FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own staff" ON staff FOR DELETE USING (auth.uid() = created_by);

-- Attendance
CREATE POLICY IF NOT EXISTS "Users can view their own attendance" ON attendance FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own attendance" ON attendance FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can update their own attendance" ON attendance FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own attendance" ON attendance FOR DELETE USING (auth.uid() = created_by);

-- Salary payments
CREATE POLICY IF NOT EXISTS "Users can view their own salary payments" ON salary_payments FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own salary payments" ON salary_payments FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can update their own salary payments" ON salary_payments FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own salary payments" ON salary_payments FOR DELETE USING (auth.uid() = created_by);

-- Stock movements
CREATE POLICY IF NOT EXISTS "Users can view their own stock movements" ON stock_movements FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can insert their own stock movements" ON stock_movements FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY IF NOT EXISTS "Users can delete their own stock movements" ON stock_movements FOR DELETE USING (auth.uid() = created_by);

-- ============================================
-- GRANT PRIVILEGES
-- ============================================
GRANT ALL ON public.suppliers TO authenticated;
GRANT ALL ON public.purchases TO authenticated;
GRANT ALL ON public.inventory TO authenticated;
GRANT ALL ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_item_recipes TO authenticated;
GRANT ALL ON public.sales TO authenticated;
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.staff TO authenticated;
GRANT ALL ON public.attendance TO authenticated;
GRANT ALL ON public.salary_payments TO authenticated;
GRANT ALL ON public.stock_movements TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Complete schema created successfully!' as message;
SELECT 'Next steps: Run inventory-automation-step2-functions.sql and step3-grants.sql' as next_step;
