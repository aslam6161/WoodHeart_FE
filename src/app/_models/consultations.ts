import { DeliveryAddress } from './order';

/**
 * Consultations, as the API shapes them.
 *
 * Mirrors `ConsultationDtos.cs`. The enums arrive as their names — `InStudio`,
 * `Requested` — because the API serialises enums as strings; the unions below
 * are those names, kept in step by hand.
 */

export type ConsultationMode = 'Online' | 'InStudio' | 'SiteVisit';

export type BookingStatus =
  | 'Requested'
  | 'Confirmed'
  | 'Rescheduled'
  | 'Completed'
  | 'Cancelled'
  | 'NoShow';

/**
 * How each mode reads to a customer.
 *
 * "Site visit" rather than "SiteVisit", and worth saying plainly: the mode is
 * the difference between an hour on a video call and somebody driving across
 * Dhaka, and it is what decides whether the form asks for an address.
 */
export const MODE_LABELS: Record<ConsultationMode, string> = {
  Online: 'Online',
  InStudio: 'At our studio',
  SiteVisit: 'At your place'
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  Requested: 'Awaiting confirmation',
  Confirmed: 'Confirmed',
  Rescheduled: 'Moved to a new time',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  NoShow: 'Missed'
};

/**
 * Requested is deliberately not green.
 *
 * It means nobody at the shop has looked at it yet, and a customer who reads
 * it as "booked" is a customer who turns up to a studio that was not expecting
 * them.
 */
export const BOOKING_STATUS_CLASS: Record<BookingStatus, string> = {
  Requested: 'text-bg-warning',
  Confirmed: 'text-bg-success',
  Rescheduled: 'text-bg-info',
  Completed: 'text-bg-secondary',
  Cancelled: 'text-bg-secondary',
  NoShow: 'text-bg-secondary'
};

/** One thing the shop sells an hour of. */
export interface ConsultationService {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  mode: ConsultationMode;
  durationMinutes: number;
  /** Zero is a free consultation, and that is a real option. */
  fee: number;
  requiresAdvance: boolean;
  /** What is asked for up front, or absent when nothing is. */
  advanceDue?: number | null;
  isActive: boolean;
  sortOrder: number;
  /** Who offers it. Empty means nothing here can be booked. */
  consultants: ConsultantSummary[];
}

export interface ConsultantSummary {
  id: number;
  name: string;
  photoPath?: string | null;
}

export interface Consultant extends ConsultantSummary {
  bio?: string | null;
  specialities: string[];
  serviceIds: number[];
  isActive: boolean;
  sortOrder: number;
}

/**
 * The times on offer, grouped by the day they are shown under.
 *
 * The dates are Dhaka's and the slots are UTC instants, which is the only
 * combination that works: a browser can render an instant in local time, and
 * cannot rebuild one from a wall-clock time it was not told the offset for.
 */
export interface Availability {
  serviceId: number;
  durationMinutes: number;
  days: AvailabilityDay[];
}

export interface AvailabilityDay {
  /** `2026-09-27` — a Dhaka date, not an instant. */
  date: string;
  slots: AvailabilitySlot[];
}

export interface AvailabilitySlot {
  startUtc: string;
  consultantId: number;
  consultantName: string;
}

/** What the wizard sends to book an appointment. */
export interface CreateBooking {
  serviceId: number;
  /** Null means "anybody", and the API assigns whoever is free. */
  consultantId?: number | null;
  /** The slot, exactly as the availability endpoint gave it. */
  startUtc: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  /** Required for a site visit, ignored otherwise. */
  siteAddress?: DeliveryAddress | null;
  projectBrief?: string | null;
  budgetRange?: string | null;
  roomTypes: string[];
}

export interface Booking {
  id: number;
  bookingNumber: string;
  serviceName: string;
  mode: ConsultationMode;
  consultantName?: string | null;
  scheduledAtUtc: string;
  durationMinutes: number;
  status: BookingStatus;
  contactName: string;
  /** Masked on the customer's own view — `+88017*****678`. */
  contactPhone: string;
  contactEmail?: string | null;
  siteAddress?: DeliveryAddress | null;
  projectBrief?: string | null;
  budgetRange?: string | null;
  roomTypes: string[];
  fee: number;
  advanceDue?: number | null;
  timeline: BookingTimelineEntry[];
  /** Whether the customer may still call it off themselves. */
  canCancel: boolean;
}

export interface BookingTimelineEntry {
  fromStatus?: BookingStatus | null;
  toStatus: BookingStatus;
  actorName: string;
  note?: string | null;
  occurredAt: string;
}

/** A guest finding their own booking again: the number plus the phone. */
export interface BookingLookup {
  bookingNumber: string;
  phone: string;
}

export interface CancelBooking {
  phone?: string | null;
  reason?: string | null;
}

/**
 * The budget bands offered in the brief.
 *
 * Bands rather than a figure because nobody knows their budget to the taka
 * before the first conversation, and an empty box gets skipped. Free text on
 * the wire — the useful bands are a commercial decision (PLAN.md §16.4), and
 * a fixed enum would mean a migration the day the shop disagrees.
 */
export const BUDGET_RANGES = [
  'Under ৳50,000',
  '৳50,000 – ৳1,50,000',
  '৳1,50,000 – ৳3,00,000',
  '৳3,00,000 – ৳6,00,000',
  'Over ৳6,00,000',
  'Not sure yet'
] as const;

/** What the consultation is about. Multiple, because most flats are. */
export const ROOM_TYPES = [
  'Living room',
  'Bedroom',
  'Kitchen',
  'Dining',
  'Study',
  'Balcony',
  'Whole flat',
  'Office'
] as const;
