-- ============================================
-- PHASE 1: DATA SAFETY, SECURITY & AUDIT
-- ============================================
-- New tables for backup, audit, customers, orders, roles
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. USER ROLES & PERMISSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'manager', 'staff', 'viewer')),
  is_active BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- 2. AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL, -- create, update, delete, login, logout
  table_name VARCHAR(100),
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 3. CUSTOMERS
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  total_purchases DECIMAL(10, 2) DEFAULT 0,
  total_payments DECIMAL(10, 2) DEFAULT 0,
  outstanding_balance DECIMAL(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT check_outstanding_balance CHECK (outstanding_balance >= 0)
);

-- ============================================
-- 4. CUSTOMER CREDIT LEDGER
-- ============================================
CREATE TABLE IF NOT EXISTS customer_credit_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  transaction_date DATE NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('credit_sale', 'payment', 'adjustment')),
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  reference_id UUID, -- Link to sales or orders
  reference_type VARCHAR(50),
  notes TEXT,
  balance_after DECIMAL(10, 2) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. TABLES (Restaurant Tables)
-- ============================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number VARCHAR(50) NOT NULL,
  table_name VARCHAR(100),
  capacity INTEGER DEFAULT 4,
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning')),
  is_active BOOLEAN DEFAULT true,
  floor VARCHAR(50),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_number)
);

-- ============================================
-- 6. ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL,
  order_date DATE NOT NULL,
  order_time TIME NOT NULL,
  order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  paid_amount DECIMAL(10, 2) DEFAULT 0,
  payment_method VARCHAR(50),
  order_status VARCHAR(20) DEFAULT 'new' CHECK (order_status IN ('new', 'preparing', 'ready', 'served', 'completed', 'cancelled')),
  kot_number VARCHAR(50),
  special_notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(order_number)
);

-- ============================================
-- 7. ORDER ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT,
  item_status VARCHAR(20) DEFAULT 'pending' CHECK (item_status IN ('pending', 'preparing', 'ready', 'served')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 8. APP SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT,
  setting_type VARCHAR(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json')),
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 9. BACKUP HISTORY
-- ============================================
CREATE TABLE IF NOT EXISTS backup_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  backup_date DATE NOT NULL,
  backup_time TIME NOT NULL,
  file_name VARCHAR(255),
  file_size BIGINT,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('initiated', 'processing', 'completed', 'failed')),
  records_count INTEGER,
  tables_included TEXT[],
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_customer ON customer_credit_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_date ON customer_credit_ledger(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date DESC, order_time DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_tables_status ON restaurant_tables(status);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

-- ============================================
-- ENABLE RLS
-- ============================================
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES - SHARED ACCESS FOR AUTHENTICATED USERS
-- ============================================
-- User Roles (Owner only)
CREATE POLICY "Only owners can view user roles" ON user_roles FOR SELECT 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));
CREATE POLICY "Only owners can manage user roles" ON user_roles FOR ALL 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

-- Audit Logs (Owner only)
CREATE POLICY "Only owners can view audit logs" ON audit_logs FOR SELECT 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

-- Customers (Shared for authenticated users)
CREATE POLICY "Authenticated users can view customers" ON customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert customers" ON customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update customers" ON customers FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete customers" ON customers FOR DELETE USING (auth.role() = 'authenticated');

-- Customer Credit Ledger (Shared)
CREATE POLICY "Authenticated users can view credit ledger" ON customer_credit_ledger FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert credit ledger" ON customer_credit_ledger FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update credit ledger" ON customer_credit_ledger FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete credit ledger" ON customer_credit_ledger FOR DELETE USING (auth.role() = 'authenticated');

-- Restaurant Tables (Shared)
CREATE POLICY "Authenticated users can view tables" ON restaurant_tables FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage tables" ON restaurant_tables FOR ALL USING (auth.role() = 'authenticated');

-- Orders (Shared)
CREATE POLICY "Authenticated users can view orders" ON orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert orders" ON orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update orders" ON orders FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete orders" ON orders FOR DELETE USING (auth.role() = 'authenticated');

-- Order Items (Shared through orders)
CREATE POLICY "Authenticated users can view order items" ON order_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage order items" ON order_items FOR ALL USING (auth.role() = 'authenticated');

-- App Settings (Owner only write, all read)
CREATE POLICY "Everyone can view settings" ON app_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Only owners can update settings" ON app_settings FOR ALL 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

-- Backup History (Owner only)
CREATE POLICY "Only owners can view backup history" ON backup_history FOR SELECT 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));
CREATE POLICY "Only owners can manage backups" ON backup_history FOR ALL 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'owner'));

-- ============================================
-- GRANT PRIVILEGES
-- ============================================
GRANT ALL ON public.user_roles TO authenticated;
GRANT ALL ON public.audit_logs TO authenticated;
GRANT ALL ON public.customers TO authenticated;
GRANT ALL ON public.customer_credit_ledger TO authenticated;
GRANT ALL ON public.restaurant_tables TO authenticated;
GRANT ALL ON public.orders TO authenticated;
GRANT ALL ON public.order_items TO authenticated;
GRANT ALL ON public.app_settings TO authenticated;
GRANT ALL ON public.backup_history TO authenticated;

-- ============================================
-- INSERT DEFAULT SETTINGS
-- ============================================
INSERT INTO app_settings (setting_key, setting_value, setting_type, description) VALUES
  ('cafe_name', 'My Cafe', 'string', 'Cafe business name'),
  ('cafe_address', '', 'string', 'Cafe address for bills'),
  ('cafe_phone', '', 'string', 'Cafe contact number'),
  ('cafe_email', '', 'string', 'Cafe email'),
  ('gst_enabled', 'false', 'boolean', 'Enable GST/Tax calculation'),
  ('gst_rate', '0', 'number', 'GST rate percentage'),
  ('tax_inclusive', 'false', 'boolean', 'Tax included in menu prices'),
  ('currency_symbol', '₹', 'string', 'Currency symbol'),
  ('invoice_prefix', 'INV', 'string', 'Invoice number prefix'),
  ('kot_prefix', 'KOT', 'string', 'KOT number prefix')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Phase 1 Schema Extensions Created Successfully!' as message;
SELECT 'Tables Created: user_roles, audit_logs, customers, customer_credit_ledger, restaurant_tables, orders, order_items, app_settings, backup_history' as tables;
