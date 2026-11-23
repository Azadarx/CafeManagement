-- ============================================
-- INVENTORY AUTOMATION - STEP 2: RPC FUNCTIONS
-- ============================================
-- Run this SECOND in Supabase SQL Editor (after step1)
-- This creates all PostgreSQL functions for atomic operations
-- ============================================

-- ============================================
-- FUNCTION 1: CREATE PURCHASE AND UPDATE INVENTORY
-- ============================================
CREATE OR REPLACE FUNCTION create_purchase_and_update_inventory(
  p_supplier_id UUID,
  p_purchase_date DATE,
  p_item_name VARCHAR,
  p_quantity DECIMAL,
  p_unit VARCHAR,
  p_unit_price DECIMAL,
  p_total_amount DECIMAL,
  p_paid_amount DECIMAL,
  p_pending_amount DECIMAL,
  p_payment_status VARCHAR,
  p_notes TEXT,
  p_created_by UUID,
  p_inventory_id UUID,
  p_link_to_inventory BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  v_purchase_id UUID;
  v_current_stock DECIMAL;
BEGIN
  -- 1. Create purchase record
  INSERT INTO purchases (
    supplier_id, purchase_date, item_name, quantity, unit,
    unit_price, total_amount, paid_amount, pending_amount,
    payment_status, notes, created_by
  ) VALUES (
    p_supplier_id, p_purchase_date, p_item_name, p_quantity, p_unit,
    p_unit_price, p_total_amount, p_paid_amount, p_pending_amount,
    p_payment_status, p_notes, p_created_by
  ) RETURNING id INTO v_purchase_id;

  -- 2. If linking to inventory
  IF p_link_to_inventory AND p_inventory_id IS NOT NULL THEN
    
    -- Check if already linked (prevent duplicates)
    IF EXISTS (
      SELECT 1 FROM stock_movements 
      WHERE reference_id = v_purchase_id 
      AND reference_type = 'purchase'
    ) THEN
      RAISE EXCEPTION 'Purchase already linked to inventory';
    END IF;

    -- Lock inventory row for update (prevents race conditions)
    SELECT stock_quantity INTO v_current_stock
    FROM inventory
    WHERE id = p_inventory_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RAISE EXCEPTION 'Inventory item not found';
    END IF;

    -- Create stock movement record
    INSERT INTO stock_movements (
      inventory_id, movement_date, movement_type, quantity,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      p_inventory_id, p_purchase_date, 'purchase', p_quantity,
      'purchase', v_purchase_id, 
      'Purchase: ' || p_item_name || ' (' || p_quantity || ' ' || p_unit || ')',
      p_created_by
    );

    -- Update inventory stock quantity
    UPDATE inventory
    SET stock_quantity = stock_quantity + p_quantity,
        last_purchase_date = p_purchase_date,
        last_purchase_price = p_unit_price,
        updated_at = NOW()
    WHERE id = p_inventory_id;

  END IF;

  RETURN json_build_object(
    'success', true,
    'purchase_id', v_purchase_id,
    'message', 'Purchase created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION 2: UPDATE PURCHASE AND ADJUST INVENTORY
-- ============================================
CREATE OR REPLACE FUNCTION update_purchase_and_adjust_inventory(
  p_purchase_id UUID,
  p_supplier_id UUID,
  p_purchase_date DATE,
  p_item_name VARCHAR,
  p_new_quantity DECIMAL,
  p_unit VARCHAR,
  p_unit_price DECIMAL,
  p_total_amount DECIMAL,
  p_paid_amount DECIMAL,
  p_pending_amount DECIMAL,
  p_payment_status VARCHAR,
  p_notes TEXT
)
RETURNS JSON AS $$
DECLARE
  v_old_quantity DECIMAL;
  v_inventory_id UUID;
  v_quantity_diff DECIMAL;
  v_current_stock DECIMAL;
BEGIN
  -- 1. Get old quantity and check if linked to inventory
  SELECT p.quantity INTO v_old_quantity
  FROM purchases p
  WHERE p.id = p_purchase_id;

  IF v_old_quantity IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Purchase not found'
    );
  END IF;

  -- 2. Check if this purchase is linked to inventory
  SELECT inventory_id INTO v_inventory_id
  FROM stock_movements
  WHERE reference_id = p_purchase_id
  AND reference_type = 'purchase'
  LIMIT 1;

  -- 3. Update purchase record
  UPDATE purchases
  SET supplier_id = p_supplier_id,
      purchase_date = p_purchase_date,
      item_name = p_item_name,
      quantity = p_new_quantity,
      unit = p_unit,
      unit_price = p_unit_price,
      total_amount = p_total_amount,
      paid_amount = p_paid_amount,
      pending_amount = p_pending_amount,
      payment_status = p_payment_status,
      notes = p_notes,
      updated_at = NOW()
  WHERE id = p_purchase_id;

  -- 4. If linked to inventory, adjust stock
  IF v_inventory_id IS NOT NULL THEN
    v_quantity_diff := p_new_quantity - v_old_quantity;

    -- Lock inventory row
    SELECT stock_quantity INTO v_current_stock
    FROM inventory
    WHERE id = v_inventory_id
    FOR UPDATE;

    -- Check if adjustment would cause negative stock
    IF (v_current_stock + v_quantity_diff) < 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Cannot reduce purchase quantity: would cause negative stock. Current stock: ' || v_current_stock || ', adjustment: ' || v_quantity_diff
      );
    END IF;

    -- Update stock movement quantity
    UPDATE stock_movements
    SET quantity = p_new_quantity,
        movement_date = p_purchase_date,
        notes = 'Purchase (Updated): ' || p_item_name || ' (' || p_new_quantity || ' ' || p_unit || ')',
        created_at = NOW()
    WHERE reference_id = p_purchase_id
    AND reference_type = 'purchase';

    -- Adjust inventory stock
    UPDATE inventory
    SET stock_quantity = stock_quantity + v_quantity_diff,
        last_purchase_date = p_purchase_date,
        last_purchase_price = p_unit_price,
        updated_at = NOW()
    WHERE id = v_inventory_id;

  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Purchase updated successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION 3: DELETE PURCHASE AND REVERSE INVENTORY
-- ============================================
CREATE OR REPLACE FUNCTION delete_purchase_and_reverse_inventory(
  p_purchase_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_inventory_id UUID;
  v_quantity DECIMAL;
  v_current_stock DECIMAL;
  v_item_name VARCHAR;
BEGIN
  -- 1. Check if linked to inventory
  SELECT inventory_id, quantity INTO v_inventory_id, v_quantity
  FROM stock_movements
  WHERE reference_id = p_purchase_id
  AND reference_type = 'purchase'
  LIMIT 1;

  -- 2. If linked, verify reversal won't cause negative stock
  IF v_inventory_id IS NOT NULL THEN
    
    SELECT stock_quantity, item_name INTO v_current_stock, v_item_name
    FROM inventory
    WHERE id = v_inventory_id
    FOR UPDATE;

    IF (v_current_stock - v_quantity) < 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Cannot delete purchase: reversal would cause negative stock for ' || v_item_name || '. Current stock: ' || v_current_stock || ', would become: ' || (v_current_stock - v_quantity)
      );
    END IF;

    -- Delete stock movement
    DELETE FROM stock_movements
    WHERE reference_id = p_purchase_id
    AND reference_type = 'purchase';

    -- Reverse inventory stock
    UPDATE inventory
    SET stock_quantity = stock_quantity - v_quantity,
        updated_at = NOW()
    WHERE id = v_inventory_id;

  END IF;

  -- 3. Delete purchase
  DELETE FROM purchases WHERE id = p_purchase_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Purchase deleted successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION 4: CREATE SALE WITH DIRECT INVENTORY DEDUCTION
-- ============================================
CREATE OR REPLACE FUNCTION create_sale_with_inventory_deduction(
  p_sale_date DATE,
  p_item_name VARCHAR,
  p_quantity INTEGER,
  p_unit_price DECIMAL,
  p_total_amount DECIMAL,
  p_payment_method VARCHAR,
  p_notes TEXT,
  p_created_by UUID,
  p_inventory_item_id UUID,
  p_menu_item_id UUID,
  p_record_as_income BOOLEAN
)
RETURNS JSON AS $$
DECLARE
  v_sale_id UUID;
  v_transaction_id UUID;
  v_current_stock DECIMAL;
  v_recipe_record RECORD;
  v_ingredient_stock DECIMAL;
  v_required_quantity DECIMAL;
  v_insufficient_ingredients TEXT[];
BEGIN
  -- CASE 1: Direct inventory item sale (e.g., bottled water)
  IF p_inventory_item_id IS NOT NULL THEN
    
    -- Lock inventory row and check stock
    SELECT stock_quantity INTO v_current_stock
    FROM inventory
    WHERE id = p_inventory_item_id
    FOR UPDATE;

    IF v_current_stock IS NULL THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Inventory item not found'
      );
    END IF;

    IF v_current_stock < p_quantity THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient stock. Available: ' || v_current_stock,
        'available_stock', v_current_stock
      );
    END IF;

    -- Create sale record
    INSERT INTO sales (
      sale_date, item_name, quantity, unit_price, total_amount,
      payment_method, notes, inventory_item_id, menu_item_id, created_by
    ) VALUES (
      p_sale_date, p_item_name, p_quantity, p_unit_price, p_total_amount,
      p_payment_method, p_notes, p_inventory_item_id, p_menu_item_id, p_created_by
    ) RETURNING id INTO v_sale_id;

    -- Create stock movement (negative quantity for deduction)
    INSERT INTO stock_movements (
      inventory_id, movement_date, movement_type, quantity,
      reference_type, reference_id, notes, created_by
    ) VALUES (
      p_inventory_item_id, p_sale_date, 'sale', -p_quantity,
      'sale', v_sale_id, 'Sale: ' || p_item_name || ' (Qty: ' || p_quantity || ')', p_created_by
    );

    -- Deduct inventory stock
    UPDATE inventory
    SET stock_quantity = stock_quantity - p_quantity,
        updated_at = NOW()
    WHERE id = p_inventory_item_id;

  -- CASE 2: Menu item sale with recipe (e.g., chai with ingredients)
  ELSIF p_menu_item_id IS NOT NULL THEN
    
    -- Check if recipe exists for this menu item
    IF NOT EXISTS (
      SELECT 1 FROM menu_item_recipes WHERE menu_item_id = p_menu_item_id
    ) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'No recipe configured for this menu item. Please configure ingredients first or select direct inventory item.'
      );
    END IF;

    -- Check ALL ingredients availability BEFORE creating sale
    v_insufficient_ingredients := ARRAY[]::TEXT[];
    
    FOR v_recipe_record IN (
      SELECT r.inventory_id, r.quantity_per_serving, r.unit, i.item_name, i.stock_quantity
      FROM menu_item_recipes r
      JOIN inventory i ON i.id = r.inventory_id
      WHERE r.menu_item_id = p_menu_item_id
      FOR UPDATE OF i  -- Lock all ingredient rows
    ) LOOP
      v_required_quantity := v_recipe_record.quantity_per_serving * p_quantity;
      
      IF v_recipe_record.stock_quantity < v_required_quantity THEN
        v_insufficient_ingredients := array_append(
          v_insufficient_ingredients,
          v_recipe_record.item_name || ': need ' || v_required_quantity || ' ' || v_recipe_record.unit || ', available ' || v_recipe_record.stock_quantity || ' ' || v_recipe_record.unit
        );
      END IF;
    END LOOP;

    -- If any ingredient is insufficient, reject the sale
    IF array_length(v_insufficient_ingredients, 1) > 0 THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Insufficient ingredients: ' || array_to_string(v_insufficient_ingredients, '; '),
        'insufficient_ingredients', v_insufficient_ingredients
      );
    END IF;

    -- All ingredients available - proceed with sale
    INSERT INTO sales (
      sale_date, item_name, quantity, unit_price, total_amount,
      payment_method, notes, inventory_item_id, menu_item_id, created_by
    ) VALUES (
      p_sale_date, p_item_name, p_quantity, p_unit_price, p_total_amount,
      p_payment_method, p_notes, NULL, p_menu_item_id, p_created_by
    ) RETURNING id INTO v_sale_id;

    -- Deduct ALL ingredients
    FOR v_recipe_record IN (
      SELECT r.inventory_id, r.quantity_per_serving, r.unit, i.item_name
      FROM menu_item_recipes r
      JOIN inventory i ON i.id = r.inventory_id
      WHERE r.menu_item_id = p_menu_item_id
    ) LOOP
      v_required_quantity := v_recipe_record.quantity_per_serving * p_quantity;

      -- Create stock movement for each ingredient
      INSERT INTO stock_movements (
        inventory_id, movement_date, movement_type, quantity,
        reference_type, reference_id, notes, created_by
      ) VALUES (
        v_recipe_record.inventory_id, p_sale_date, 'sale', -v_required_quantity,
        'sale', v_sale_id,
        'Ingredient for sale: ' || p_item_name || ' (Used: ' || v_required_quantity || ' ' || v_recipe_record.unit || ')',
        p_created_by
      );

      -- Deduct ingredient stock
      UPDATE inventory
      SET stock_quantity = stock_quantity - v_required_quantity,
          updated_at = NOW()
      WHERE id = v_recipe_record.inventory_id;
    END LOOP;

  ELSE
    RETURN json_build_object(
      'success', false,
      'error', 'Either inventory_item_id or menu_item_id must be provided'
    );
  END IF;

  -- Record as income in Daily Hisab if requested
  IF p_record_as_income THEN
    INSERT INTO transactions (
      transaction_date, transaction_type, category, amount,
      description, payment_method, reference_id, reference_type, created_by
    ) VALUES (
      p_sale_date, 'income', 'Sales', p_total_amount,
      'Sale of ' || p_item_name || ' (Qty: ' || p_quantity || ')',
      p_payment_method, v_sale_id, 'sale', p_created_by
    ) RETURNING id INTO v_transaction_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'transaction_id', v_transaction_id,
    'message', 'Sale created and inventory updated successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION 5: UPDATE SALE AND ADJUST INVENTORY
-- ============================================
CREATE OR REPLACE FUNCTION update_sale_and_adjust_inventory(
  p_sale_id UUID,
  p_sale_date DATE,
  p_item_name VARCHAR,
  p_new_quantity INTEGER,
  p_unit_price DECIMAL,
  p_total_amount DECIMAL,
  p_payment_method VARCHAR,
  p_notes TEXT
)
RETURNS JSON AS $$
DECLARE
  v_old_quantity INTEGER;
  v_inventory_item_id UUID;
  v_menu_item_id UUID;
  v_quantity_diff INTEGER;
  v_current_stock DECIMAL;
  v_recipe_record RECORD;
  v_required_quantity DECIMAL;
  v_old_required DECIMAL;
  v_ingredient_stock DECIMAL;
  v_insufficient_ingredients TEXT[];
BEGIN
  -- 1. Get old sale details
  SELECT quantity, inventory_item_id, menu_item_id
  INTO v_old_quantity, v_inventory_item_id, v_menu_item_id
  FROM sales
  WHERE id = p_sale_id;

  IF v_old_quantity IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sale not found'
    );
  END IF;

  v_quantity_diff := p_new_quantity - v_old_quantity;

  -- CASE 1: Direct inventory item sale
  IF v_inventory_item_id IS NOT NULL THEN
    
    -- Lock inventory row
    SELECT stock_quantity INTO v_current_stock
    FROM inventory
    WHERE id = v_inventory_item_id
    FOR UPDATE;

    -- Check if adjustment is possible (restore old + deduct new)
    -- Net effect: stock needs to accommodate the DIFFERENCE
    IF v_quantity_diff > 0 THEN
      -- Increasing quantity - need more stock
      IF v_current_stock < v_quantity_diff THEN
        RETURN json_build_object(
          'success', false,
          'error', 'Insufficient stock for update. Need ' || v_quantity_diff || ' more, available: ' || v_current_stock
        );
      END IF;
    END IF;
    -- If decreasing (v_quantity_diff < 0), we're restoring stock, always safe

    -- Update sale record
    UPDATE sales
    SET sale_date = p_sale_date,
        item_name = p_item_name,
        quantity = p_new_quantity,
        unit_price = p_unit_price,
        total_amount = p_total_amount,
        payment_method = p_payment_method,
        notes = p_notes,
        updated_at = NOW()
    WHERE id = p_sale_id;

    -- Update stock movement
    UPDATE stock_movements
    SET quantity = -p_new_quantity,
        movement_date = p_sale_date,
        notes = 'Sale (Updated): ' || p_item_name || ' (Qty: ' || p_new_quantity || ')',
        created_at = NOW()
    WHERE reference_id = p_sale_id
    AND reference_type = 'sale'
    AND inventory_id = v_inventory_item_id;

    -- Adjust inventory (reverse old, apply new = add difference)
    UPDATE inventory
    SET stock_quantity = stock_quantity - v_quantity_diff,
        updated_at = NOW()
    WHERE id = v_inventory_item_id;

  -- CASE 2: Menu item with recipe
  ELSIF v_menu_item_id IS NOT NULL THEN
    
    -- If increasing quantity, check all ingredients
    IF v_quantity_diff > 0 THEN
      v_insufficient_ingredients := ARRAY[]::TEXT[];
      
      FOR v_recipe_record IN (
        SELECT r.inventory_id, r.quantity_per_serving, r.unit, i.item_name, i.stock_quantity
        FROM menu_item_recipes r
        JOIN inventory i ON i.id = r.inventory_id
        WHERE r.menu_item_id = v_menu_item_id
        FOR UPDATE OF i
      ) LOOP
        v_required_quantity := v_recipe_record.quantity_per_serving * v_quantity_diff;
        
        IF v_recipe_record.stock_quantity < v_required_quantity THEN
          v_insufficient_ingredients := array_append(
            v_insufficient_ingredients,
            v_recipe_record.item_name || ': need ' || v_required_quantity || ' more'
          );
        END IF;
      END LOOP;

      IF array_length(v_insufficient_ingredients, 1) > 0 THEN
        RETURN json_build_object(
          'success', false,
          'error', 'Insufficient ingredients: ' || array_to_string(v_insufficient_ingredients, '; ')
        );
      END IF;
    END IF;

    -- Update sale record
    UPDATE sales
    SET sale_date = p_sale_date,
        item_name = p_item_name,
        quantity = p_new_quantity,
        unit_price = p_unit_price,
        total_amount = p_total_amount,
        payment_method = p_payment_method,
        notes = p_notes,
        updated_at = NOW()
    WHERE id = p_sale_id;

    -- Adjust all ingredient stocks
    FOR v_recipe_record IN (
      SELECT r.inventory_id, r.quantity_per_serving, r.unit
      FROM menu_item_recipes r
      WHERE r.menu_item_id = v_menu_item_id
    ) LOOP
      v_required_quantity := v_recipe_record.quantity_per_serving * v_quantity_diff;

      -- Update existing stock movements (just update the first one, or create pattern)
      UPDATE stock_movements
      SET quantity = -(v_recipe_record.quantity_per_serving * p_new_quantity),
          movement_date = p_sale_date,
          created_at = NOW()
      WHERE reference_id = p_sale_id
      AND reference_type = 'sale'
      AND inventory_id = v_recipe_record.inventory_id;

      -- Adjust inventory
      UPDATE inventory
      SET stock_quantity = stock_quantity - v_required_quantity,
          updated_at = NOW()
      WHERE id = v_recipe_record.inventory_id;
    END LOOP;

  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Sale updated successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION 6: DELETE SALE AND RESTORE INVENTORY
-- ============================================
CREATE OR REPLACE FUNCTION delete_sale_and_restore_inventory(
  p_sale_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_movement_record RECORD;
BEGIN
  -- 1. Find all stock movements for this sale and restore inventory
  FOR v_movement_record IN (
    SELECT inventory_id, quantity
    FROM stock_movements
    WHERE reference_id = p_sale_id
    AND reference_type = 'sale'
  ) LOOP
    
    -- Restore inventory (quantity is negative, so subtracting it adds back)
    UPDATE inventory
    SET stock_quantity = stock_quantity - v_movement_record.quantity,
        updated_at = NOW()
    WHERE id = v_movement_record.inventory_id;

  END LOOP;

  -- 2. Delete stock movements
  DELETE FROM stock_movements
  WHERE reference_id = p_sale_id
  AND reference_type = 'sale';

  -- 3. Delete linked transaction in Daily Hisab
  DELETE FROM transactions
  WHERE reference_id = p_sale_id
  AND reference_type = 'sale';

  -- 4. Delete sale
  DELETE FROM sales WHERE id = p_sale_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Sale deleted and inventory restored successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Step 2 Complete: All RPC functions created successfully!' as message;
