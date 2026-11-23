-- ============================================
-- STOCK MOVEMENTS TABLE - INVENTORY MODULE
-- ============================================
-- This table tracks all inventory stock changes
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- CREATE STOCK MOVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE NOT NULL,
  movement_date DATE NOT NULL,
  movement_type VARCHAR(50) NOT NULL, -- 'purchase', 'adjustment_in', 'adjustment_out', 'wastage'
  quantity DECIMAL(10, 2) NOT NULL, -- positive for IN, negative for OUT
  reference_type VARCHAR(50), -- 'purchase', 'manual', 'wastage'
  reference_id UUID, -- purchase.id if linked to a purchase
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_stock_movements_inventory ON stock_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_id, reference_type);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Users can view their own stock movements
CREATE POLICY "Users can view their own stock movements"
  ON stock_movements FOR SELECT
  USING (auth.uid() = created_by);

-- Users can insert their own stock movements
CREATE POLICY "Users can insert their own stock movements"
  ON stock_movements FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Users can delete their own stock movements
CREATE POLICY "Users can delete their own stock movements"
  ON stock_movements FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================
-- GRANT PRIVILEGES
-- ============================================
GRANT ALL ON public.stock_movements TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
-- Stock movements table created successfully!
-- You can now track inventory changes with full audit trail.
