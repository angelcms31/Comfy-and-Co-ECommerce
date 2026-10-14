import { http } from '@/lib/http';
import type { User } from '@/types/db';
import type { UserProfile } from '@/types/models';

export type ProfilePatch = Partial<Pick<User, 'full_name' | 'birthdate' | 'mobile_no' | 'st_add' | 'postal' | 'city_id'>>;

export const userService = {
  getProfile: () => http<UserProfile>('/users/me'),
  updateProfile: (patch: ProfilePatch) => http<UserProfile>('/users/me', { method: 'PATCH', body: patch }),
};
