import { api } from '@/shared/lib/api';
import type { Cafe, CafeSearchParams } from '../types/explore.types';

export const CAFE_PLACEHOLDER_IMAGE =
  'https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=600&auto=format&fit=crop';

function formatTrackType(trackType: any): string {
  if (trackType && typeof trackType === 'object' && 'name' in trackType) {
    return trackType.name;
  }
  if (typeof trackType === 'string') {
    return trackType
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return '';
}

function toNumber(value: any): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getCafes(params: CafeSearchParams = {}): Promise<Cafe[]> {
  try {
    const apiParams: any = {
      page: 1,
      limit: 100,
    };
    if (params.city && params.city !== 'all') {
      apiParams.city = params.city;
    }
    if (params.trackType && params.trackType !== 'all') {
      apiParams.track_type = params.trackType;
    }

    const response = await api.get('/cafes', { params: apiParams });
    const cafesData = response.data?.data || [];

    return cafesData.map((cafe: any): Cafe => {
      const slotFeeRate = toNumber(cafe.slotFeeRate);
      const lat = toNumber(cafe.latitude);
      const lng = toNumber(cafe.longitude);

      return {
        id: cafe.id,
        providerId: cafe.providerId,
        name: cafe.name,
        slug: cafe.slug,
        rating: 0,
        reviewsCount: 0,
        phone: cafe.phone,
        status: cafe.status,
        address: cafe.address,
        district: cafe.district,
        city: cafe.city,
        image: cafe.coverImageUrl || CAFE_PLACEHOLDER_IMAGE,
        images: cafe.coverImageUrl ? [cafe.coverImageUrl] : [CAFE_PLACEHOLDER_IMAGE],
        priceRange: slotFeeRate > 0 ? `${slotFeeRate.toLocaleString('vi-VN')} đ/slot` : 'Chưa cập nhật',
        slotDurationMinutes: cafe.slotDurationMinutes,
        slotFeeRate,
        maxConcurrentBookings: cafe.maxConcurrentBookings,
        minBookingNoticeMinutes: cafe.minBookingNoticeMinutes,
        byocCapacity: cafe.byocCapacity,
        trackTypes: Array.isArray(cafe.trackTypes) ? cafe.trackTypes.map(formatTrackType) : [],
        trackTypeIds: Array.isArray(cafe.trackTypes) ? cafe.trackTypes.map((t: any) => t.id) : [],
        features: [],
        description: cafe.description || 'Cơ sở chưa cập nhật mô tả.',
        coordinates: { x: 50, y: 50 },
        latitude: lat || null,
        longitude: lng || null,
        availableVehicles: [],
        operatingHours: cafe.operatingHours,
      };
    });
  } catch (error) {
    console.error('[ExploreAPI] Error fetching cafes:', error);
    return [];
  }
}
