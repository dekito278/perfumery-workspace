import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
	throw new Error('Missing VITE_SUPABASE_URL');
}

if (!supabaseAnonKey) {
	throw new Error('Missing VITE_SUPABASE_ANON_KEY');
}

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		persistSession: true,
		autoRefreshToken: true,
		detectSessionInUrl: true,
	},
});

export default supabaseClient;
export { supabaseClient };
