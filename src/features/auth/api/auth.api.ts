import { API_ENDPOINTS } from '@/shared/constants';
import { api } from '@/shared/lib/api';
import type { ApiResponse } from '@/shared/types/api';

import { mapBackendProfile, mapLoginResponse } from '../lib/auth-mappers';
import type {
  AuthUser,
  BackendLoginResponse,
  BackendProfile,
  LoginRequest,
  LoginResponse,
} from '../types/auth.types';

export async function loginWithPassword(payload: LoginRequest): Promise<LoginResponse> {
  const response = await api.post<ApiResponse<BackendLoginResponse>>(
    API_ENDPOINTS.auth.login,
    payload,
  );

  return mapLoginResponse(response.data.data);
}

export async function getMe(): Promise<AuthUser> {
  const response = await api.get<ApiResponse<BackendProfile>>(API_ENDPOINTS.auth.me);
  return mapBackendProfile(response.data.data);
}

export async function logoutSession(refreshToken: string): Promise<void> {
  await api.post(API_ENDPOINTS.auth.logout, { refresh_token: refreshToken });
}
