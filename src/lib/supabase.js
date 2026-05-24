import { createClient } from '@supabase/supabase-js';
import { useAuthStore } from '../store/authStore';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a single supabase client for interacting with your database
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false // We use our own authStore and cookies
  }
});

// Helper to set realtime JWT
export const setRealtimeAuth = () => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    supabase.realtime.setAuth(token);
  }
};
