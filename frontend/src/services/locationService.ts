import { http } from '@/lib/http';
import type { CityWithCountry } from '@/types/models';

export const locationService = {
  getCities: () => http<CityWithCountry[]>('/cities'),
};
