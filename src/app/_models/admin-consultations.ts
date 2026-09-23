import { BookingStatus, ConsultationMode } from './consultations';

/**
 * The shop's side of consultations, as the API shapes them.
 *
 * Mirrors the admin half of `ConsultationDtos.cs`. The customer-facing shapes
 * live in `consultations.ts` and are shared — a booking is one thing, read two
 * ways.
 */

/** One row of the shop's diary. */
export interface BookingListItem {
  id: number;
  bookingNumber: string;
  serviceName: string;
  mode: ConsultationMode;
  consultantName?: string | null;
  scheduledAtUtc: string;
  durationMinutes: number;
  status: BookingStatus;
  contactName: string;
  /** Unmasked: the board is behind a staff policy, and ringing is the point. */
  contactPhone: string;
  /** "Dhanmondi, Dhaka" for a site visit, absent otherwise. */
  siteLocation?: string | null;
  fee: number;
  advanceDue?: number | null;
  /** When it was asked for, so a request nobody has answered stands out. */
  requestedAt: string;
}

/**
 * What the board asks for.
 *
 * An empty query means "today onwards" — the API decides that, not the
 * screen. A search term is the exception and looks across the whole history.
 */
export interface BookingQuery {
  term?: string | null;
  status?: BookingStatus | null;
  consultantId?: number | null;
  mode?: ConsultationMode | null;
  /** Dhaka dates, `YYYY-MM-DD`. */
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
}

export interface ChangeBookingStatus {
  status: BookingStatus;
  note?: string | null;
}

/** Moving a booking to another time, and possibly to somebody else. */
export interface RescheduleBooking {
  /** The slot, exactly as the availability endpoint gave it. */
  startUtc: string;
  /** Null keeps whoever has it. */
  consultantId?: number | null;
  note?: string | null;
}

// -----------------------------------------------------------------------------
// Writing what the shop offers
// -----------------------------------------------------------------------------

export interface SaveConsultationService {
  nameEn: string;
  nameBn?: string | null;
  slug?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  mode: ConsultationMode;
  durationMinutes: number;
  fee: number;
  requiresAdvance: boolean;
  advanceAmount?: number | null;
  /** Quiet time either side of the appointment. Travel, or clearing the room. */
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  isActive: boolean;
  sortOrder: number;
}

export interface SaveConsultant {
  name: string;
  photoPath?: string | null;
  bioEn?: string | null;
  bioBn?: string | null;
  specialities: string[];
  /** The whole set, sent in full — like a discount's targets. */
  serviceIds: number[];
  isActive: boolean;
  sortOrder: number;
}

/** One weekly working window. */
export interface AvailabilityRule {
  dayOfWeek: DayName;
  /** `10:00:00`. */
  startTime: string;
  endTime: string;
  /** How far apart the offered times are. */
  slotMinutes: number;
}

/** A day that is not like the others: a holiday, or a half day. */
export interface AvailabilityException {
  /** A Dhaka date, `YYYY-MM-DD`. */
  date: string;
  isClosed: boolean;
  startTime?: string | null;
  endTime?: string | null;
  note?: string | null;
}

/**
 * A consultant's whole diary, replaced in one go.
 *
 * All-or-nothing, like the settings screen, and the API takes it that way. A
 * week is one decision — the Friday off only makes sense beside the Saturday
 * morning — and a partial save is how somebody ends up bookable on a day
 * nobody meant.
 */
export interface SaveSchedule {
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
}

export interface ConsultantSchedule {
  id: number;
  name: string;
  photoPath?: string | null;
  bio?: string | null;
  specialities: string[];
  serviceIds: number[];
  isActive: boolean;
  sortOrder: number;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
}

export type DayName =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

/**
 * The week, starting on Sunday.
 *
 * Sunday first because that is where the Bangladeshi working week starts.
 * Friday and Saturday are the weekend, and the editor says so rather than
 * leaving somebody to notice that two of the seven rows are unusual.
 */
export const WEEK: readonly { day: DayName; weekend: boolean }[] = [
  { day: 'Sunday', weekend: false },
  { day: 'Monday', weekend: false },
  { day: 'Tuesday', weekend: false },
  { day: 'Wednesday', weekend: false },
  { day: 'Thursday', weekend: false },
  { day: 'Friday', weekend: true },
  { day: 'Saturday', weekend: true }
];

/** What each mode is called on the admin side — plainer than the shop copy. */
export const ADMIN_MODE_LABELS: Record<ConsultationMode, string> = {
  Online: 'Online',
  InStudio: 'In studio',
  SiteVisit: 'Site visit'
};
