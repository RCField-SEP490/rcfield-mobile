import { api } from '@/shared/lib/api';

export type Companion = {
  name: string;
  phone: string;
};

export interface TrackConfig {
  id: string;
  name: string;
  description: string | null;
  status: string;
  track_type_id: string;
  track_type?: { id: string; name: string } | null;
}

export interface VehicleCatalog {
  id: string;
  name: string;
  description: string | null;
  price_per_hour: number;
  image: string | null;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number | string;
  image: string | null;
  available: boolean;
}

export interface CheckAvailabilityParams {
  slot_start: string;
  slot_end: string;
  play_mode: 'RENTAL' | 'BYOC';
  track_config_id?: string;
}

export interface AvailabilityResponse {
  play_mode: 'RENTAL' | 'BYOC';
  available: boolean;
  byoc_remaining?: number;
  vehicles?: { id: string; name: string }[];
}

export interface CreateBookingPayload {
  cafe_id: string;
  play_mode: 'RENTAL' | 'BYOC';
  slot_start: string;
  slot_end: string;
  vehicle_ids?: string[];
  participants: {
    participant_type: 'WALK_IN_GUEST';
    guest_name?: string;
    guest_phone?: string;
  }[];
  fnb_items?: { menu_item_id: string; quantity: number }[];
  track_type_id?: string;
  track_config_id?: string;
  customer_package_id?: string;
  promotion_code?: string;
}

export interface CreateBookingResult {
  booking_id: string;
  total_amount: number;
}

export interface CheckoutResponse {
  confirmed: boolean;
  payment_url?: string;
}

export interface PromoValidationResult {
  code: string;
  discount_amount: number;
  discount_type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
}

export const bookingWizardApi = {
  getCafeTrackConfigs: async (cafeId: string): Promise<TrackConfig[]> => {
    try {
      const response = await api.get(`/cafes/${cafeId}/track-configs`);
      return response.data?.data || [];
    } catch (error) {
      console.error('[BookingWizardAPI] Error fetching track configs:', error);
      return [];
    }
  },

  getCafeCatalogs: async (cafeId: string): Promise<VehicleCatalog[]> => {
    try {
      const response = await api.get(`/cafes/${cafeId}/vehicle-catalogs`);
      return response.data?.data || [];
    } catch (error) {
      console.error('[BookingWizardAPI] Error fetching vehicle catalogs:', error);
      return [];
    }
  },

  getCafeMenu: async (cafeId: string): Promise<MenuItem[]> => {
    try {
      const response = await api.get(`/cafes/${cafeId}/menu`, {
        params: { available: true, limit: 100 },
      });
      return response.data?.data || [];
    } catch (error) {
      console.error('[BookingWizardAPI] Error fetching menu items:', error);
      return [];
    }
  },

  checkAvailability: async (
    cafeId: string,
    params: CheckAvailabilityParams
  ): Promise<AvailabilityResponse> => {
    const response = await api.get(`/cafes/${cafeId}/availability`, { params });
    return response.data?.data;
  },

  validatePromoCode: async (
    code: string,
    cafeId: string,
    slotStart: string
  ): Promise<PromoValidationResult> => {
    const response = await api.post('/promotions/validate', {
      code,
      cafe_id: cafeId,
      slot_start: slotStart,
    });
    return response.data?.data;
  },

  createBooking: async (payload: CreateBookingPayload): Promise<CreateBookingResult> => {
    const response = await api.post('/bookings', payload);
    return response.data?.data;
  },

  createCheckout: async (bookingId: string): Promise<CheckoutResponse> => {
    const response = await api.post(`/bookings/${bookingId}/checkout`);
    return response.data?.data;
  },

  mockCheckout: async (bookingId: string): Promise<void> => {
    await api.post(`/bookings/${bookingId}/mock-checkout`);
  },
};
