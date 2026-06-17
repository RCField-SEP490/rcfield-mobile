import { AxiosHeaders, create } from 'axios';

import { env } from '@/shared/config/env';
import { secureTokenStorage } from '@/shared/lib/secure-storage';

export const api = create({
  baseURL: env.apiUrl,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const accessToken = await secureTokenStorage.getAccessToken();

  if (accessToken) {
    config.headers = AxiosHeaders.from(config.headers);
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return config;
});
