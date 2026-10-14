import { http, HttpError } from '@/lib/http';
import { clearSession, getSavedSession, saveSession } from '@/lib/session';
import type { RegisterInput, Session, UserProfile } from '@/types/models';

// FastAPI handles Supabase Auth and returns { access_token, user }
export const authService = {
  async login(email: string, password: string, remember = true) {
    const session = await http<Session>('/auth/login', { method: 'POST', body: { email, password } });
    saveSession(session, remember);
    return session;
  },

  async register(input: RegisterInput) {
    const session = await http<Session>('/auth/register', { method: 'POST', body: input });
    saveSession(session);
    return session;
  },

  async logout() {
    await http<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearSession();
  },

  // checks the saved token is still valid and gets the latest profile
  async getSession(): Promise<Session | null> {
    const saved = getSavedSession();
    if (!saved) return null;
    try {
      const user = await http<UserProfile>('/auth/me');
      return { ...saved, user };
    } catch (err) {
      // only log out when the token is rejected, not when the server is just down
      if (err instanceof HttpError && err.status === 401) {
        clearSession();
        return null;
      }
      return saved;
    }
  },

  // forgot password: send code -> verify code (gives a reset_token) -> set new password
  sendResetCode: (email: string) => http<void>('/auth/forgot-password', { method: 'POST', body: { email } }),
  verifyResetCode: (email: string, code: string) =>
    http<{ reset_token: string }>('/auth/verify-code', { method: 'POST', body: { email, code } }),
  resetPassword: (resetToken: string, newPassword: string) =>
    http<void>('/auth/reset-password', { method: 'POST', body: { reset_token: resetToken, new_password: newPassword } }),
};
