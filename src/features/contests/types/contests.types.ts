export type UserRole = 'CUSTOMER' | 'PROVIDER' | 'STAFF' | 'ADMIN';

export type ContestStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export type ContestRegistrationStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CANCELLED';

export type ContestEntryFeePaymentStatus = 'PENDING_PAYMENT' | 'PENDING_REVIEW' | 'MARKED_PAID' | 'WAIVED' | 'NOT_REQUIRED';

export type ContestMatchStatus = 'DRAFT' | 'READY' | 'RUNNING' | 'COMPLETED' | 'CANCELLED';

export type ContestParticipantStatus = 'READY' | 'FINISHED' | 'DNS' | 'DNF' | 'DQ';

export type VehicleSource = 'RENTAL' | 'BYOC';

export interface ByocDeclaration {
  vehicle_name: string;
  vehicle_brand: string | null;
  vehicle_class: string | null;
  notes: string | null;
  photos: string[];
}

export interface ContestRegistration {
  id: string;
  contestId: string;
  userId: string;
  participantRoleSnapshot: UserRole;
  vehicleSource: VehicleSource;
  rentalCatalogId: string | null;
  rentalCafeId: string | null;
  vehicleId: string | null;
  bookingId: string | null;
  status: ContestRegistrationStatus;
  checkInCode: string;
  entryFeeAmount: number;
  paymentStatus: ContestEntryFeePaymentStatus;
  metadata: {
    byoc_declaration?: ByocDeclaration | null;
    fee_note?: string | null;
    [key: string]: any;
  } | null;
  createdAt: string;
  
  contest?: Contest;
  participant?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
  };
  customer_journey_status?: string;
}

export interface LeaderboardEntry {
  rank: number;
  registration_id: string;
  user_id: string | null;
  display_name: string | null;
  driver_handle: string | null;
  driver_title_label: string | null;
  wins: number;
  best_lap_seconds: number | null;
  total_time_seconds: number | null;
  latest_finish_position: number | null;
  matches_completed: number;
  progressed_round: number;
  last_played_round: number;
  won_last_match: boolean;
  real_wins: number;
  fixed_rank: number | null;
}

export interface PublishedLeaderboard {
  mode: string;
  entries: LeaderboardEntry[];
  match_count: number;
  published_at: string;
  published_by: string;
}

export interface Contest {
  id: string;
  cafeId: string;
  providerId: string;
  name: string;
  description: string | null;
  trackTypeId: string;
  contestTypeId: string;
  contestFormatId: string;
  contestTemplateId: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  capacity: number | null;
  entryFee: number;
  status: ContestStatus;
  bannerImageUrl: string | null;
  vehicleRule: {
    vehicle_policy: 'RENTAL_ONLY' | 'BYOC_ONLY' | 'MIXED';
    assignment_policy?: string;
    byoc_require_tech_inspection?: boolean;
    allowed_catalog_ids?: string[];
  } | null;
  config: {
    format?: string;
    runtime_format?: string;
    drivers_per_match?: number;
    seeding_mode?: string;
    auto_bye?: boolean;
    competition_mechanic?: string;
    prizes?: { rank: number; title: string; description: string }[];
    published_leaderboard?: PublishedLeaderboard | null;
    [key: string]: any;
  } | null;
  
  my_registration?: ContestRegistration | null;
  published_leaderboard?: PublishedLeaderboard | null;
}

export interface ContestMatchParticipant {
  registrationId: string;
  fullName: string;
  status: ContestParticipantStatus;
  isWinner: boolean;
  slotNo: number;
  lane: string | null;
  seedNo: number | null;
  finishPosition: number | null;
  bestLapMs: number | null;
  totalTimeMs: number | null;
  resultNote?: string | null;
  registration?: ContestRegistration | null;
}

export interface ContestMatch {
  id: string;
  contestId: string;
  cafeId: string;
  roundNo: number;
  matchNo: number;
  name: string | null;
  matchType: string;
  status: ContestMatchStatus;
  nextMatchId: string | null;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  createdBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  advancementRule: {
    winners_to_advance?: number;
    format?: string;
    [key: string]: any;
  } | null;
  resultSummary: {
    winner_registration_id?: string | null;
    participants_count?: number;
    bye?: boolean;
    [key: string]: any;
  } | null;
  metadata: {
    seeded?: boolean;
    bye?: boolean;
    empty_slot?: boolean;
    third_place?: boolean;
    [key: string]: any;
  } | null;
  participants: ContestMatchParticipant[];
}
