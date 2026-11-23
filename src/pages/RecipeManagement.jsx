import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

function RecipeManagement() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [recipes, setRecipes] = useState({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [ingredientForm, setIngredientForm] = useState({
    inventory_id: '',
    quantity_per_serving: '',
    unit: ''
  });

  // Fetch menu items
  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('item_name', { ascending: true });

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
    }
  };

  // Fetch inventory items
  const fetchInventoryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, item_name, unit, stock_quantity')
        .order('item_name', { ascending: true });

      if (error) throw error;
      setInventoryItems(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  // Fetch all recipes
  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_item_recipes')
        .select(`
          *,
          inventory:inventory_id (
            item_name,
            unit,
            stock_quantity
          ),
          menu_items:menu_item_id (
            item_name
          )
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group recipes by menu_item_id
      const grouped = {};
      (data || []).forEach(recipe => {
        if (!grouped[recipe.menu_item_id]) {
          grouped[recipe.menu_item_id] = [];
        }
        grouped[recipe.menu_item_id].push(recipe);
      });

      setRecipes(grouped);
    } catch (error) {
      console.error('Error fetching recipes:', error);
      alert('Error loading recipes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuItems();
    fetchInventoryItems();
    fetchRecipes();
  }, []);

  // Open modal to add ingredient
  const openAddIngredientModal = (menuItem) => {
    setSelectedMenuItem(menuItem);
    setIngredientForm({
      inventory_id: '',
      quantity_per_serving: '',
      unit: ''
    });
    setIsModalOpen(true);
  };

  // Handle form change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setIngredientForm(prev => ({
      ...prev,
      [name]: value
    }));

    // Auto-fill unit when inventory item is selected
    if (name === 'inventory_id' && value) {
      const item = inventoryItems.find(i => i.id === value);
      if (item) {
        setIngredientForm(prev => ({
          ...prev,
          unit: item.unit
        }));
      }
    }
  };

  // Add ingredient to recipe
  const handleAddIngredient = async (e) => {
    e.preventDefault();

    if (!ingredientForm.inventory_id || !ingredientForm.quantity_per_serving) {
      alert('Please fill all required fields');
      return;
    }

    const quantity = parseFloat(ingredientForm.quantity_per_serving);
    if (quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    try {
      const { error } = await supabase
        .from('menu_item_recipes')
        .insert([{
          menu_item_id: selectedMenuItem.id,
          inventory_id: ingredientForm.inventory_id,
          quantity_per_serving: quantity,
          unit: ingredientForm.unit,
          created_by: user.id
        }]);

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          alert('This ingredient is already added to this recipe');
        } else {
          throw error;
        }
        return;
      }

      alert('Ingredient added to recipe!');
      setIsModalOpen(false);
      fetchRecipes();
    } catch (error) {
      console.error('Error adding ingredient:', error);
      alert('Error adding ingredient: ' + error.message);
    }
  };

  // Delete ingredient from recipe
  const handleDeleteIngredient = async (recipeId, ingredientName) => {
    if (!confirm(`Remove ${ingredientName} from this recipe?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('menu_item_recipes')
        .delete()
        .eq('id', recipeId);

      if (error) throw error;

      alert('Ingredient removed from recipe!');
      fetchRecipes();
    } catch (error) {
      console.error('Error deleting ingredient:', error);
      alert('Error removing ingredient: ' + error.message);
    }
  };

  // Calculate if menu item can be made with current stock
  const canMakeItem = (menuItemId, quantity = 1) => {
    const recipe = recipes[menuItemId];
    if (!recipe || recipe.length === 0) return { canMake: false, reason: 'No recipe configured' };

    for (const ingredient of recipe) {
      const required = parseFloat(ingredient.quantity_per_serving) * quantity;
      const available = parseFloat(ingredient.inventory?.stock_quantity || 0);
      
      if (available < required) {
        return { 
          canMake: false, 
          reason: `Insufficient ${ingredient.inventory?.item_name}: need ${required.toFixed(2)} ${ingredient.unit}, have ${available.toFixed(2)} ${ingredient.unit}` 
        };
      }
    }

    return { canMake: true, reason: 'All ingredients available' };
  };

  return (
    <div className="p-3 sm:p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Recipe Management</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">Configure ingredients for each menu item</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 p-3 sm:p-4 rounded-lg mb-4 sm:mb-6">
        <p className="text-xs sm:text-sm text-purple-800">
          <strong>🍽️ How it works:</strong> When you sell a menu item with a configured recipe, 
          all ingredient quantities will be automatically deducted from inventory. 
          If any ingredient is insufficient, the sale will be rejected.
        </p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {menuItems.map((menuItem) => {
            const itemRecipes = recipes[menuItem.id] || [];
            const availability = canMakeItem(menuItem.id, 1);

            return (
              <div key={menuItem.id} className="bg-white rounded-lg shadow p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0 mb-4">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800">{menuItem.item_name}</h3>
                    <p className="text-xs sm:text-sm text-gray-600">
                      Selling Price: ₹{parseFloat(menuItem.selling_price).toFixed(2)} | 
                      Cost: ₹{parseFloat(menuItem.cost_price).toFixed(2)}
                    </p>
                    {itemRecipes.length > 0 && (
                      <div className="mt-2">
                        {availability.canMake ? (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
                            ✓ Can be made
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700 max-w-full">
                            <span className="truncate">✗ {availability.reason}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => openAddIngredientModal(menuItem)}
                    className="w-full sm:w-auto bg-purple-600 text-white px-3 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-purple-700 transition-colors whitespace-nowrap"
                  >
                    + Add Ingredient
                  </button>
                </div>

                {itemRecipes.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <p className="text-xs sm:text-sm">No recipe configured yet</p>
                    <p className="text-xs">Add ingredients to enable automatic inventory deduction</p>
                  </div>
                ) : (
                  <div className="border-t pt-4">
                    <p className="text-xs sm:text-sm font-medium text-gray-700 mb-3">Recipe (per serving):</p>
                    <div className="space-y-2">
                      {itemRecipes.map((recipe) => {
                        const required = parseFloat(recipe.quantity_per_serving);
                        const available = parseFloat(recipe.inventory?.stock_quantity || 0);
                        const isInsufficient = available < required;

                        return (
                          <div 
                            key={recipe.id} 
                            className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 rounded-lg ${
                              isInsufficient ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium text-gray-800 truncate">
                                {recipe.inventory?.item_name}
                              </p>
                              <p className="text-xs text-gray-600">
                                Required: {required.toFixed(4)} {recipe.unit} | 
                                Available: {available.toFixed(2)} {recipe.unit}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteIngredient(recipe.id, recipe.inventory?.item_name)}
                              className="text-red-600 hover:text-red-700 text-xs sm:text-sm font-medium whitespace-nowrap"
                            >
                              Remove
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Ingredient Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Add Ingredient to ${selectedMenuItem?.item_name}`}
      >
        <form onSubmit={handleAddIngredient} className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Select Ingredient *
            </label>
            <select
              name="inventory_id"
              value={ingredientForm.inventory_id}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            >
              <option value="">Choose ingredient...</option>
              {inventoryItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_name} (Stock: {parseFloat(item.stock_quantity).toFixed(2)} {item.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Quantity per Serving *
            </label>
            <input
              type="number"
              name="quantity_per_serving"
              value={ingredientForm.quantity_per_serving}
              onChange={handleChange}
              placeholder="0.0000"
              step="0.0001"
              min="0.0001"
              required
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: 0.120 for 120ml, 0.010 for 10g
            </p>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input
              type="text"
              name="unit"
              value={ingredientForm.unit}
              onChange={handleChange}
              placeholder="Auto-filled from inventory"
              readOnly
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-gray-50 outline-none"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> When a customer orders 1 serving of this item, 
              the specified quantity of this ingredient will be deducted from inventory.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4">
            <button
              type="submit"
              className="flex-1 bg-purple-600 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Add Ingredient
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default RecipeManagement;
