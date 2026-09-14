// A momentary blip on the auth path, versus a real failure.
//
// Import-free on purpose, so the node guard can import it and test the rule as BEHAVIOUR rather than
// as a string in a React file.
//
// `AbortError: Lock broken` comes from Supabase's navigator lock when another tab takes it — ordinary
// for anyone with several tabs open, and unrelated to whether MFA is satisfied. Network blips look the
// same from here.
//
// Everything NOT recognised as momentary is deliberately treated as a real failure: MFA resolution that
// cannot be decided MUST end closed. That is the whole point of the split — see AuthContext.
export const isTransientAuthError = (error) => {
  const name = String(error?.name || '');
  const message = String(error?.message || '');

  return name === 'AbortError'
    || /lock/i.test(message)
    || /network|failed to fetch|timeout|timed out/i.test(message);
};
