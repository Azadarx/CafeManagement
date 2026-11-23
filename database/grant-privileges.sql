-- ============================================
-- GRANT TABLE PRIVILEGES TO AUTHENTICATED USERS
-- ============================================
-- This gives authenticated users permission to access tables
-- Run this in Supabase SQL Editor
-- ============================================

-- Grant all privileges on all tables to authenticated users
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.suppliers TO authenticated;
GRANT ALL ON public.purchases TO authenticated;
GRANT ALL ON public.inventory TO authenticated;
GRANT ALL ON public.menu_items TO authenticated;
GRANT ALL ON public.sales TO authenticated;
GRANT ALL ON public.staff TO authenticated;
GRANT ALL ON public.attendance TO authenticated;
GRANT ALL ON public.salary_payments TO authenticated;

-- Also grant usage on sequences (for auto-incrementing IDs if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Success message
SELECT 'Table privileges granted successfully!' as message;
