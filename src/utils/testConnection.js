import { supabase } from './supabaseClient';

export async function testDatabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test 1: Check if supabase client is initialized
    console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
    console.log('Supabase Key exists:', !!import.meta.env.VITE_SUPABASE_ANON_KEY);
    
    // Test 2: Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Current user:', user);
    if (authError) console.error('Auth error:', authError);
    
    // Test 3: Try to read from transactions table
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Database error:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Database query successful!', data);
    return { success: true, data };
    
  } catch (err) {
    console.error('Connection test failed:', err);
    return { success: false, error: err.message };
  }
}
