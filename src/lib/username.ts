/**
 * Username-based login on top of Supabase Auth.
 *
 * Supabase Auth identifies users by email or phone — there is no username
 * primitive. So a username is stored as an email under a domain that receives
 * no mail: `hai` -> `hai@haithichdi.local`. Accounts are created with
 * email_confirm: true, so nothing is ever sent there.
 *
 * Consequence: no self-service password reset. Passwords are reset by an admin
 * from the Leaders page, which matches how this panel already works.
 *
 * The same constant is duplicated in supabase/functions/admin-users/index.ts —
 * keep the two in sync.
 */
export const INTERNAL_EMAIL_DOMAIN = 'haithichdi.local';

/** Lowercase, starts alphanumeric, 3–30 chars of [a-z0-9._-]. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** What the login form and the edge function send to Supabase Auth. */
export function usernameToEmail(input: string): string {
  const value = input.trim();
  // Accounts created before usernames existed sign in with their real email.
  return value.includes('@') ? value : `${value.toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

/** What the panel displays. Real emails are shown as-is. */
export function emailToUsername(email: string | null | undefined): string {
  if (!email) return '';
  const suffix = `@${INTERNAL_EMAIL_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
