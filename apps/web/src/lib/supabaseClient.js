import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_AUTH_STORAGE_KEY = 'solivagant.supabase.auth.v1';

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
		storageKey: SUPABASE_AUTH_STORAGE_KEY,
	},
});

export default supabaseClient;
export { SUPABASE_AUTH_STORAGE_KEY, supabaseClient };
