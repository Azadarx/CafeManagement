-- ============================================
-- INVENTORY AUTOMATION - STEP 1: SCHEMA CHANGES
-- ============================================
-- Run this FIRST in Supabase SQL Editor
-- This adds necessary columns, tables, and constraints
-- ============================================

-- ============================================
-- 1. ADD CONSTRAINTS TO PREVENT NEGATIVE STOCK
-- ============================================
ALTER TABLE inventory
ADD CONSTRAINT check_positive_stock 
CHECK (stock_quantity >= 0);

-- ============================================
-- 2. ADD inventory_item_id TO SALES TABLE
-- ============================================
ALTER TABLE sales
ADD COLUMN inventory_item_id UUID REFERENCES inventory(id) ON DELETE SET NULL;

CREATE INDEX idx_sales_inventory ON sales(inventory_item_id);

-- ============================================
-- 3. CREATE MENU ITEM RECIPES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS menu_item_recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
  quantity_per_serving DECIMAL(10, 4) NOT NULL, -- e.g., 0.120 liters, 0.010 kg
  unit VARCHAR(50) NOT NULL, -- Should match inventory.unit for that ingredient
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(menu_item_id, inventory_id) -- Prevent duplicate ingredients
);

-- ============================================
-- 4. ADD INDEXES FOR RECIPE TABLE
-- ============================================
CREATE INDEX idx_recipes_menu_item ON menu_item_recipes(menu_item_id);
CREATE INDEX idx_recipes_inventory ON menu_item_recipes(inventory_id);

-- ============================================
-- 5. ENABLE RLS ON RECIPE TABLE
-- ============================================
ALTER TABLE menu_item_recipes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for recipe table
CREATE POLICY "Authenticated users can view all recipes"
  ON menu_item_recipes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert recipes"
  ON menu_item_recipes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update all recipes"
  ON menu_item_recipes FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete all recipes"
  ON menu_item_recipes FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================
-- 6. GRANT PRIVILEGES
-- ============================================
GRANT ALL ON public.menu_item_recipes TO authenticated;

-- ============================================
-- 7. ADD UNIQUE INDEX TO PREVENT DUPLICATE PURCHASE LINKS
-- ============================================
CREATE UNIQUE INDEX idx_stock_movements_unique_purchase_link
ON stock_movements(reference_id, reference_type)
WHERE reference_type = 'purchase';

-- ============================================
-- 8. UPDATE stock_movements TO SUPPORT 'sale' TYPE
-- ============================================
-- No schema change needed - movement_type is VARCHAR(50)
-- Just documenting that valid values are now:
-- 'purchase', 'sale', 'adjustment_in', 'adjustment_out', 'wastage'

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Step 1 Complete: Schema changes applied successfully!' as message;
