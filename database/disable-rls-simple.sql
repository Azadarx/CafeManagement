-- ============================================
-- SIMPLE FIX: Disable RLS temporarily
-- ============================================
-- This will allow all authenticated users full access
-- Run this in Supabase SQL Editor
-- ============================================

-- Disable RLS on all tables
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_payments DISABLE ROW LEVEL SECURITY;

-- Success message
SELECT 'RLS disabled on all tables - your app should work now!' as message;
