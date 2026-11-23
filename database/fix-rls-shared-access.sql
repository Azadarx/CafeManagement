-- ============================================
-- FIX: RLS POLICIES FOR SHARED CAFE ACCESS
-- ============================================
-- This allows multiple users (you and your father) to share the same data
-- Run this in Supabase SQL Editor
-- ============================================

-- OPTION 1: SIMPLE - Make all tables accessible to all authenticated users
-- (Use this if both you and father should see ALL the same data)

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

DROP POLICY IF EXISTS "Users can view their own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can insert their own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can update their own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can delete their own suppliers" ON suppliers;

DROP POLICY IF EXISTS "Users can view their own purchases" ON purchases;
DROP POLICY IF EXISTS "Users can insert their own purchases" ON purchases;
DROP POLICY IF EXISTS "Users can update their own purchases" ON purchases;
DROP POLICY IF EXISTS "Users can delete their own purchases" ON purchases;

DROP POLICY IF EXISTS "Users can view their own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can insert their own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can update their own inventory" ON inventory;
DROP POLICY IF EXISTS "Users can delete their own inventory" ON inventory;

DROP POLICY IF EXISTS "Users can view their own menu items" ON menu_items;
DROP POLICY IF EXISTS "Users can insert their own menu items" ON menu_items;
DROP POLICY IF EXISTS "Users can update their own menu items" ON menu_items;
DROP POLICY IF EXISTS "Users can delete their own menu items" ON menu_items;

DROP POLICY IF EXISTS "Users can view their own sales" ON sales;
DROP POLICY IF EXISTS "Users can insert their own sales" ON sales;
DROP POLICY IF EXISTS "Users can update their own sales" ON sales;
DROP POLICY IF EXISTS "Users can delete their own sales" ON sales;

DROP POLICY IF EXISTS "Users can view their own staff" ON staff;
DROP POLICY IF EXISTS "Users can insert their own staff" ON staff;
DROP POLICY IF EXISTS "Users can update their own staff" ON staff;
DROP POLICY IF EXISTS "Users can delete their own staff" ON staff;

DROP POLICY IF EXISTS "Users can view their own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can insert their own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can update their own attendance" ON attendance;
DROP POLICY IF EXISTS "Users can delete their own attendance" ON attendance;

DROP POLICY IF EXISTS "Users can view their own salary payments" ON salary_payments;
DROP POLICY IF EXISTS "Users can insert their own salary payments" ON salary_payments;
DROP POLICY IF EXISTS "Users can update their own salary payments" ON salary_payments;
DROP POLICY IF EXISTS "Users can delete their own salary payments" ON salary_payments;

-- Create new policies that allow ALL authenticated users to access data
-- (Perfect for a 2-user cafe where both should see everything)

-- Transactions
CREATE POLICY "Authenticated users can view all transactions"
  ON transactions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert transactions"
  ON transactions FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all transactions"
  ON transactions FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all transactions"
  ON transactions FOR DELETE
  USING (auth.role() = 'authenticated');

-- Suppliers
CREATE POLICY "Authenticated users can view all suppliers"
  ON suppliers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert suppliers"
  ON suppliers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all suppliers"
  ON suppliers FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all suppliers"
  ON suppliers FOR DELETE
  USING (auth.role() = 'authenticated');

-- Purchases
CREATE POLICY "Authenticated users can view all purchases"
  ON purchases FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert purchases"
  ON purchases FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all purchases"
  ON purchases FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all purchases"
  ON purchases FOR DELETE
  USING (auth.role() = 'authenticated');

-- Inventory
CREATE POLICY "Authenticated users can view all inventory"
  ON inventory FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert inventory"
  ON inventory FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all inventory"
  ON inventory FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all inventory"
  ON inventory FOR DELETE
  USING (auth.role() = 'authenticated');

-- Menu Items
CREATE POLICY "Authenticated users can view all menu items"
  ON menu_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert menu items"
  ON menu_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all menu items"
  ON menu_items FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all menu items"
  ON menu_items FOR DELETE
  USING (auth.role() = 'authenticated');

-- Sales
CREATE POLICY "Authenticated users can view all sales"
  ON sales FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert sales"
  ON sales FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all sales"
  ON sales FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all sales"
  ON sales FOR DELETE
  USING (auth.role() = 'authenticated');

-- Staff
CREATE POLICY "Authenticated users can view all staff"
  ON staff FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert staff"
  ON staff FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all staff"
  ON staff FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all staff"
  ON staff FOR DELETE
  USING (auth.role() = 'authenticated');

-- Attendance
CREATE POLICY "Authenticated users can view all attendance"
  ON attendance FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert attendance"
  ON attendance FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all attendance"
  ON attendance FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all attendance"
  ON attendance FOR DELETE
  USING (auth.role() = 'authenticated');

-- Salary Payments
CREATE POLICY "Authenticated users can view all salary payments"
  ON salary_payments FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert salary payments"
  ON salary_payments FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all salary payments"
  ON salary_payments FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all salary payments"
  ON salary_payments FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- RLS policies updated for shared cafe access!
-- Both you and your father will now see the same data
