-- ============================================
-- PHASE 1: RPC FUNCTIONS FOR NEW FEATURES
-- ============================================
-- Customer Credit, Order Management, Audit Logging
-- Run AFTER phase1-schema-extensions.sql
-- ============================================

-- ============================================
-- FUNCTION 1: CREATE CUSTOMER CREDIT SALE
-- ============================================
CREATE OR REPLACE FUNCTION create_customer_credit_sale(
  p_customer_id UUID,
  p_transaction_date DATE,
  p_amount DECIMAL,
  p_reference_id UUID,
  p_reference_type VARCHAR,
  p_notes TEXT,
  p_created_by UUID
)
RETURNS JSON AS $$
DECLARE
  v_ledger_id UUID;
  v_current_balance DECIMAL;
BEGIN
  -- Lock customer row
  SELECT outstanding_balance INTO v_current_balance
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;

  -- Calculate new balance
  v_current_balance := v_current_balance + p_amount;

  -- Insert ledger entry
  INSERT INTO customer_credit_ledger (
    customer_id, transaction_date, transaction_type, amount,
    reference_id, reference_type, notes, balance_after, created_by
  ) VALUES (
    p_customer_id, p_transaction_date, 'credit_sale', p_amount,
    p_reference_id, p_reference_type, p_notes, v_current_balance, p_created_by
  ) RETURNING id INTO v_ledger_id;

  -- Update customer balance and totals
  UPDATE customers
  SET outstanding_balance = v_current_balance,
      total_purchases = total_purchases + p_amount,
      updated_at = NOW()
  WHERE id = p_customer_id;

  RETURN json_build_object(
    'success', true,
    'ledger_id', v_ledger_id,
    'new_balance', v_current_balance,
    'message', 'Credit sale recorded successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION 2: RECORD CUSTOMER PAYMENT
-- ============================================
CREATE OR REPLACE FUNCTION record_customer_payment(
  p_customer_id UUID,
  p_transaction_date DATE,
  p_amount DECIMAL,
  p_payment_method VARCHAR,
  p_notes TEXT,
  p_created_by UUID
)
RETURNS JSON AS $$
DECLARE
  v_ledger_id UUID;
  v_current_balance DECIMAL;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Payment amount must be greater than zero'
    );
  END IF;

  -- Lock customer row
  SELECT outstanding_balance INTO v_current_balance
  FROM customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Customer not found'
    );
  END IF;

  -- Check if payment exceeds outstanding
  IF p_amount > v_current_balance THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Payment amount exceeds outstanding balance. Outstanding: ₹' || v_current_balance
    );
  END IF;

  -- Calculate new balance
  v_current_balance := v_current_balance - p_amount;

  -- Insert ledger entry
  INSERT INTO customer_credit_ledger (
    customer_id, transaction_date, transaction_type, amount,
    payment_method, notes, balance_after, created_by
  ) VALUES (
    p_customer_id, p_transaction_date, 'payment', -p_amount,
    p_payment_method, p_notes, v_current_balance, p_created_by
  ) RETURNING id INTO v_ledger_id;

  -- Update customer balance and totals
  UPDATE customers
  SET outstanding_balance = v_current_balance,
      total_payments = total_payments + p_amount,
      updated_at = NOW()
  WHERE id = p_customer_id;

  RETURN json_build_object(
    'success', true,
    'ledger_id', v_ledger_id,
    'new_balance', v_current_balance,
    'message', 'Payment recorded successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION 3: CREATE ORDER WITH ITEMS
-- ============================================
CREATE OR REPLACE FUNCTION create_order_with_items(
  p_order_number VARCHAR,
  p_order_date DATE,
  p_order_time TIME,
  p_order_type VARCHAR,
  p_customer_id UUID,
  p_table_id UUID,
  p_items JSONB, -- Array of {menu_item_id, item_name, quantity, unit_price, special_instructions}
  p_discount DECIMAL,
  p_tax_amount DECIMAL,
  p_special_notes TEXT,
  p_created_by UUID
)
RETURNS JSON AS $$
DECLARE
  v_order_id UUID;
  v_kot_number VARCHAR;
  v_subtotal DECIMAL := 0;
  v_total_amount DECIMAL;
  v_item JSONB;
  v_item_subtotal DECIMAL;
  v_menu_item_id UUID;
  v_insufficient_ingredients TEXT[];
  v_recipe_record RECORD;
  v_required_quantity DECIMAL;
BEGIN
  -- Calculate subtotal
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL;
    v_subtotal := v_subtotal + v_item_subtotal;
  END LOOP;

  v_total_amount := v_subtotal - COALESCE(p_discount, 0) + COALESCE(p_tax_amount, 0);

  -- Generate KOT number
  v_kot_number := 'KOT-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS');

  -- Check ingredient availability for all menu items BEFORE creating order
  v_insufficient_ingredients := ARRAY[]::TEXT[];
  
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;
    
    IF v_menu_item_id IS NOT NULL THEN
      -- Check if menu item has recipe
      IF EXISTS (SELECT 1 FROM menu_item_recipes WHERE menu_item_id = v_menu_item_id) THEN
        
        -- Check all ingredients for this menu item
        FOR v_recipe_record IN (
          SELECT r.inventory_id, r.quantity_per_serving, r.unit, i.item_name, i.stock_quantity
          FROM menu_item_recipes r
          JOIN inventory i ON i.id = r.inventory_id
          WHERE r.menu_item_id = v_menu_item_id
          FOR UPDATE OF i
        ) LOOP
          v_required_quantity := v_recipe_record.quantity_per_serving * (v_item->>'quantity')::INTEGER;
          
          IF v_recipe_record.stock_quantity < v_required_quantity THEN
            v_insufficient_ingredients := array_append(
              v_insufficient_ingredients,
              (v_item->>'item_name') || ': insufficient ' || v_recipe_record.item_name || 
              ' (need ' || v_required_quantity || ' ' || v_recipe_record.unit || 
              ', have ' || v_recipe_record.stock_quantity || ')'
            );
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  -- If any ingredient is insufficient, reject the order
  IF array_length(v_insufficient_ingredients, 1) > 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot create order - insufficient ingredients: ' || array_to_string(v_insufficient_ingredients, '; '),
      'insufficient_ingredients', v_insufficient_ingredients
    );
  END IF;

  -- Create order
  INSERT INTO orders (
    order_number, order_date, order_time, order_type, customer_id, table_id,
    subtotal, discount, tax_amount, total_amount, kot_number,
    special_notes, created_by
  ) VALUES (
    p_order_number, p_order_date, p_order_time, p_order_type, p_customer_id, p_table_id,
    v_subtotal, p_discount, p_tax_amount, v_total_amount, v_kot_number,
    p_special_notes, p_created_by
  ) RETURNING id INTO v_order_id;

  -- Create order items and deduct inventory
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_subtotal := (v_item->>'quantity')::INTEGER * (v_item->>'unit_price')::DECIMAL;
    v_menu_item_id := (v_item->>'menu_item_id')::UUID;

    -- Insert order item
    INSERT INTO order_items (
      order_id, menu_item_id, item_name, quantity, unit_price, subtotal, special_instructions
    ) VALUES (
      v_order_id,
      v_menu_item_id,
      v_item->>'item_name',
      (v_item->>'quantity')::INTEGER,
      (v_item->>'unit_price')::DECIMAL,
      v_item_subtotal,
      v_item->>'special_instructions'
    );

    -- Deduct ingredients if menu item has recipe
    IF v_menu_item_id IS NOT NULL THEN
      FOR v_recipe_record IN (
        SELECT r.inventory_id, r.quantity_per_serving, r.unit
        FROM menu_item_recipes r
        WHERE r.menu_item_id = v_menu_item_id
      ) LOOP
        v_required_quantity := v_recipe_record.quantity_per_serving * (v_item->>'quantity')::INTEGER;

        -- Create stock movement
        INSERT INTO stock_movements (
          inventory_id, movement_date, movement_type, quantity,
          reference_type, reference_id, 
          notes, created_by
        ) VALUES (
          v_recipe_record.inventory_id, p_order_date, 'sale', -v_required_quantity,
          'order', v_order_id,
          'Order ' || p_order_number || ': ' || (v_item->>'item_name'),
          p_created_by
        );

        -- Deduct from inventory
        UPDATE inventory
        SET stock_quantity = stock_quantity - v_required_quantity,
            updated_at = NOW()
        WHERE id = v_recipe_record.inventory_id;
      END LOOP;
    END IF;
  END LOOP;

  -- Update table status if dine-in
  IF p_table_id IS NOT NULL AND p_order_type = 'dine_in' THEN
    UPDATE restaurant_tables
    SET status = 'occupied',
        updated_at = NOW()
    WHERE id = p_table_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'order_id', v_order_id,
    'kot_number', v_kot_number,
    'total_amount', v_total_amount,
    'message', 'Order created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION 4: COMPLETE ORDER PAYMENT
-- ============================================
CREATE OR REPLACE FUNCTION complete_order_payment(
  p_order_id UUID,
  p_payment_method VARCHAR,
  p_paid_amount DECIMAL,
  p_updated_by UUID
)
RETURNS JSON AS $$
DECLARE
  v_total_amount DECIMAL;
  v_payment_status VARCHAR;
  v_order_type VARCHAR;
  v_customer_id UUID;
  v_table_id UUID;
BEGIN
  -- Get order details
  SELECT total_amount, order_type, customer_id, table_id
  INTO v_total_amount, v_order_type, v_customer_id, v_table_id
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF v_total_amount IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Order not found'
    );
  END IF;

  -- Determine payment status
  IF p_paid_amount >= v_total_amount THEN
    v_payment_status := 'paid';
  ELSIF p_paid_amount > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'unpaid';
  END IF;

  -- Update order
  UPDATE orders
  SET payment_status = v_payment_status,
      paid_amount = p_paid_amount,
      payment_method = p_payment_method,
      order_status = CASE WHEN v_payment_status = 'paid' THEN 'completed' ELSE order_status END,
      completed_at = CASE WHEN v_payment_status = 'paid' THEN NOW() ELSE completed_at END,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Free table if dine-in and fully paid
  IF v_table_id IS NOT NULL AND v_order_type = 'dine_in' AND v_payment_status = 'paid' THEN
    UPDATE restaurant_tables
    SET status = 'available',
        updated_at = NOW()
    WHERE id = v_table_id;
  END IF;

  -- Handle remaining balance as customer credit if customer exists and partial payment
  IF v_customer_id IS NOT NULL AND v_payment_status = 'partial' THEN
    PERFORM create_customer_credit_sale(
      v_customer_id,
      CURRENT_DATE,
      v_total_amount - p_paid_amount,
      p_order_id,
      'order',
      'Outstanding from Order',
      p_updated_by
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'payment_status', v_payment_status,
    'message', 'Payment recorded successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION 5: CANCEL ORDER AND RESTORE INVENTORY
-- ============================================
CREATE OR REPLACE FUNCTION cancel_order_and_restore_inventory(
  p_order_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_movement_record RECORD;
  v_table_id UUID;
BEGIN
  -- Get table ID
  SELECT table_id INTO v_table_id
  FROM orders
  WHERE id = p_order_id;

  -- Restore all inventory deductions
  FOR v_movement_record IN (
    SELECT inventory_id, quantity
    FROM stock_movements
    WHERE reference_id = p_order_id
    AND reference_type = 'order'
  ) LOOP
    -- Restore inventory (quantity is negative, subtracting adds back)
    UPDATE inventory
    SET stock_quantity = stock_quantity - v_movement_record.quantity,
        updated_at = NOW()
    WHERE id = v_movement_record.inventory_id;
  END LOOP;

  -- Delete stock movements
  DELETE FROM stock_movements
  WHERE reference_id = p_order_id
  AND reference_type = 'order';

  -- Update order status
  UPDATE orders
  SET order_status = 'cancelled',
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Free table if occupied
  IF v_table_id IS NOT NULL THEN
    UPDATE restaurant_tables
    SET status = 'available',
        updated_at = NOW()
    WHERE id = v_table_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Order cancelled and inventory restored'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================
GRANT EXECUTE ON FUNCTION create_customer_credit_sale TO authenticated;
GRANT EXECUTE ON FUNCTION record_customer_payment TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_with_items TO authenticated;
GRANT EXECUTE ON FUNCTION complete_order_payment TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_order_and_restore_inventory TO authenticated;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Phase 1 RPC Functions Created Successfully!' as message;
SELECT 'Functions: create_customer_credit_sale, record_customer_payment, create_order_with_items, complete_order_payment, cancel_order_and_restore_inventory' as functions;
