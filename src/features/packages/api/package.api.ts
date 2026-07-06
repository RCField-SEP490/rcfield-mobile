import { api } from '@/shared/lib/api';

export type CustomerPackageStatus = 'ACTIVE' | 'PENDING_PAYMENT' | 'EXHAUSTED' | 'EXPIRED';

export interface MyPackageResponse {
  id: string;
  package_id: string;
  cafe_id: string;
  cafe_name: string;
  package_name: string;
  applicable_play_modes: string[];
  slots_total: number;
  slots_remaining: number;
  expires_at: string;
  status: CustomerPackageStatus;
  purchased_price: number;
  created_at: string;
}

export async function getMyPackages(status?: CustomerPackageStatus): Promise<MyPackageResponse[]> {
  try {
    const response = await api.get('/customers/me/packages', {
      params: { status },
    });
    return response.data?.data || [];
  } catch (error) {
    console.error('[PackageAPI] Error fetching customer packages:', error);
    return [];
  }
}
