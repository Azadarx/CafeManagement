-- ============================================
-- INVENTORY AUTOMATION - STEP 3: GRANT PERMISSIONS
-- ============================================
-- Run this THIRD in Supabase SQL Editor (after step2)
-- This grants execute permissions to authenticated users
-- ============================================

-- Grant EXECUTE permission on all RPC functions
GRANT EXECUTE ON FUNCTION create_purchase_and_update_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION update_purchase_and_adjust_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION delete_purchase_and_reverse_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION create_sale_with_inventory_deduction TO authenticated;
GRANT EXECUTE ON FUNCTION update_sale_and_adjust_inventory TO authenticated;
GRANT EXECUTE ON FUNCTION delete_sale_and_restore_inventory TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Step 3 Complete: Permissions granted successfully! Database setup complete.' as message;
