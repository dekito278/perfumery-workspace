// Shared admin gate for serverless endpoints. Extracted from api/formula/import-pdf.js so the material
// importers reuse it rather than growing a fourth copy (audit round 8).
//
// Reuses public.is_admin() (20260715120000) rather than re-deriving admin-ness: called with the caller's
// own bearer token, Supabase rejects an invalid or expired JWT with a non-2xx, and the SECURITY DEFINER
// function answers false for any authenticated non-admin — a signed-in customer included. One round trip
// settles both questions, and the service-role key is never involved.
import process from 'node:process';

const getHeader = (request, name) => (
  request.headers?.[name.toLowerCase()] || request.headers?.[name] || ''
);

export const assertAdmin = async (request) => {
  const token = String(getHeader(request, 'authorization')).replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    throw Object.assign(new Error('Auth is not configured'), { statusCode: 500 });
  }

  const result = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });

  if (!result.ok) {
    throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
  }
  if (await result.json() !== true) {
    throw Object.assign(new Error('Admin access required'), { statusCode: 403 });
  }
};
