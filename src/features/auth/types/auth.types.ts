export type UserRole = 'customer' | 'staff' | 'provider' | 'admin';

export type BackendUserRole = 'CUSTOMER' | 'STAFF' | 'PROVIDER' | 'ADMIN';

export interface AuthUser {
  assignedCafeId?: string | null;
  avatarUrl?: string;
  email: string;
  fullName: string;
  id: string;
  phone?: string;
  registrationStatus?: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface BackendLoginUser {
  assignedCafeId?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  email: string;
  fullName?: string;
  full_name?: string;
  id: string;
  phone?: string | null;
  registration_status?: string;
  role: BackendUserRole;
}

export interface BackendLoginResponse {
  access_token: string;
  refresh_token: string;
  user: BackendLoginUser;
}

export interface BackendProfile {
  assignedCafeId?: string | null;
  avatarUrl?: string | null;
  email: string;
  fullName: string;
  id: string;
  phone: string | null;
  role: BackendUserRole;
}
