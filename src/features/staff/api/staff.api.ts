import { api } from '@/shared/lib/api';

export type StaffBookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'AWAITING_PAYMENT'
  | 'COMPLETED';

export type StaffFnbOrderStatus = 'PENDING' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
export type StaffInspectionType = 'CHECK_IN' | 'CHECK_OUT';
export type StaffBookingSource = 'APP' | 'STAFF_MANUAL';
export type StaffPlayMode = 'RENTAL' | 'BYOC' | 'MIXED';
export type StaffInspectionItemStatus =
  | 'OK'
  | 'SCRATCHED'
  | 'BROKEN'
  | 'MISSING'
  | 'DIRTY'
  | 'NEEDS_REVIEW';

export interface TodayBookingItem {
  bookingId: string;
  shortCode: string;
  cafeId: string;
  cafeName: string;
  cafeAddress: string;
  trackName: string;
  trackType: string;
  playMode: 'RENTAL' | 'BYOC' | 'MIXED';
  source: 'APP' | 'STAFF_MANUAL';
  status: StaffBookingStatus;
  slotStart: string;
  slotEnd: string;
  totalAmount: number;
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  plannedParticipants: string[];
  participantDetails?: { name: string; phone?: string; isBooker: boolean }[];
  plannedVehicles: string[];
  sessions: StaffSessionSummary[];
}

export interface StaffSessionSummary {
  sessionId?: string;
  id?: string;
  status?: string;
  plannedEnd?: string;
  plannedEndAt?: string;
}

export interface TodayFnbOrderItem {
  id: string;
  bookingId: string;
  status: StaffFnbOrderStatus;
  totalAmount: number;
  createdAt: string;
  slotStart: string;
  customerName: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    notes: string | null;
  }[];
}

export interface StaffSessionDetail {
  sessionId: string;
  bookingId: string;
  cafeId?: string;
  cafeName?: string;
  cafeAddress?: string;
  bookingSource?: StaffBookingSource;
  playMode?: StaffPlayMode;
  status: string;
  staffName: string;
  actualStart?: string;
  actualEnd?: string;
  plannedEnd: string;
  participants: { name: string; type: string }[];
  vehicles: {
    vehicleId: string;
    name: string;
    type: 'RENT' | 'BYOC';
    imageUrl?: string;
    damageMultiplier?: number;
  }[];
  inspections: {
    inspectionId: string;
    type: 'CHECK_IN' | 'CHECK_OUT';
    photos: { url: string; angle: string; notes?: string }[];
    checklist: { itemKey: string; itemLabel: string; status: string; note?: string | null }[];
    staffNotes?: string;
    customerConfirmed?: boolean;
    customerConfirmedAt?: string;
    damageFlagged?: boolean;
    damageDescription?: string;
    estimatedCost?: number;
    damageMultiplier?: number;
    finalCharge?: number;
  }[];
  extensionProposal?: {
    proposalId: string;
    extraMinutes: number;
    additionalFee: number;
    newPlannedEnd: string;
    expiresAt?: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  };
  approvedExtensionFee?: number;
  approvedExtensionMinutes?: number;
  approvedExtensions?: {
    proposalId: string;
    extraMinutes: number;
    additionalFee: number;
    approvedAt?: string;
  }[];
  extensionPricingOptions?: {
    extraMinutes: number;
    additionalFee: number;
    newPlannedEnd: string;
    available: boolean;
    blockedReason?: string;
  }[];
  fnbOrders: {
    orderId: string;
    orderType: string;
    status: string;
    items: { name: string; qty: number; price: number }[];
    total: number;
  }[];
}

export interface SubmitInspectionPayload {
  type: StaffInspectionType;
  photos?: { url: string; angle: string; notes?: string }[];
  checklist?: {
    itemKey: string;
    itemLabel: string;
    status: StaffInspectionItemStatus;
    note?: string;
  }[];
  staffNotes?: string;
  damageFlagged?: boolean;
  damageDetails?: {
    description: string;
    estimatedCost: number;
    damageMultiplier?: number;
    finalCharge?: number;
  };
}

export interface StaffMenuItem {
  id: string;
  name: string;
  price: number | string;
  image?: string | null;
  imageUrl?: string | null;
  image_url?: string | null;
  available?: boolean;
  isAvailable?: boolean;
}

export interface StaffVehicleUnit {
  id: string;
  status: string;
  identifier?: string | null;
  color?: string | null;
  distinctiveImageUrl?: string | null;
  distinctive_image_url?: string | null;
  catalog?: {
    id?: string;
    name?: string;
    tier?: string;
    cover_image_url?: string | null;
  } | null;
}

export const staffApi = {
  async getTodayBookings(): Promise<TodayBookingItem[]> {
    const response = await api.get<{ success: boolean; data: TodayBookingItem[] }>(
      '/staff/today-bookings'
    );
    return response.data.data || [];
  },

  async checkIn(bookingId: string): Promise<any> {
    const response = await api.post<{ success: boolean; data: any }>(
      `/staff/bookings/${bookingId}/check-in`
    );
    return response.data.data;
  },

  async getFnbOrders(): Promise<TodayFnbOrderItem[]> {
    const response = await api.get<{ success: boolean; data: TodayFnbOrderItem[] }>(
      '/staff/fnb-orders'
    );
    return response.data.data || [];
  },

  async updateFnbOrder(orderId: string, status: StaffFnbOrderStatus): Promise<void> {
    await api.patch(`/staff/fnb-orders/${orderId}`, { status });
  },

  async getSessionDetail(sessionId: string): Promise<StaffSessionDetail> {
    const response = await api.get<{ success: boolean; data: StaffSessionDetail }>(
      `/staff/sessions/${sessionId}`
    );
    return response.data.data;
  },

  async submitInspection(sessionId: string, payload: SubmitInspectionPayload): Promise<any> {
    const response = await api.post<{ success: boolean; data: any }>(
      `/staff/sessions/${sessionId}/inspections`,
      payload
    );
    return response.data.data;
  },

  async simulateClientCheckOut(sessionId: string): Promise<any> {
    const response = await api.post<{ success: boolean; data: any }>(
      `/staff/sessions/${sessionId}/simulate-check-out-response`
    );
    return response.data.data;
  },

  async proposeExtension(
    sessionId: string,
    payload: { extraMinutes: number; additionalFee?: number; direct?: boolean }
  ): Promise<any> {
    const response = await api.post<{ success: boolean; data: any }>(
      `/staff/sessions/${sessionId}/extensions`,
      payload
    );
    return response.data.data;
  },

  async addSessionFnbOrder(
    sessionId: string,
    payload: { items: { name: string; qty: number; price: number }[] }
  ): Promise<any> {
    const response = await api.post<{ success: boolean; data: any }>(
      `/staff/sessions/${sessionId}/fnb-orders`,
      payload
    );
    return response.data.data;
  },

  async swapSessionVehicle(
    sessionId: string,
    payload: { oldVehicleId: string; newVehicleId: string; oldVehicleNewStatus: 'AVAILABLE' | 'MAINTENANCE' }
  ): Promise<any> {
    const response = await api.post<{ success: boolean; data: any }>(
      `/staff/sessions/${sessionId}/swap-vehicle`,
      payload
    );
    return response.data.data;
  },

  async getCafeMenu(cafeId: string): Promise<StaffMenuItem[]> {
    const response = await api.get<{ success: boolean; data: StaffMenuItem[] }>(
      `/cafes/${cafeId}/menu`,
      { params: { available: true, limit: 100 } }
    );
    return response.data.data || [];
  },

  async getCafeVehicles(cafeId: string): Promise<StaffVehicleUnit[]> {
    const response = await api.get<{ success: boolean; data: StaffVehicleUnit[] }>(
      `/cafes/${cafeId}/vehicles`,
      { params: { status: 'AVAILABLE', exclude_retired: true } }
    );
    return response.data.data || [];
  },

  async settlePendingPayments(bookingId: string): Promise<any> {
    const response = await api.post<{ success: boolean; data: any }>(
      `/staff/bookings/${bookingId}/settle-pending-payments`
    );
    return response.data.data;
  },
};
