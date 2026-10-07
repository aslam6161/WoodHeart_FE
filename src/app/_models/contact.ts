/**
 * What a message is about.
 *
 * String values, because the API serialises its enums as names — a number here
 * would silently stop matching the day somebody inserts a value into the middle
 * of the C# enum.
 */
export type ContactTopic =
  | 'General'
  | 'Order'
  | 'Delivery'
  | 'Product'
  | 'Consultation'
  | 'Complaint';

/** Where a message stands in the shop's inbox. */
export type ContactMessageStatus = 'New' | 'Read' | 'Answered' | 'Spam';

/**
 * How to reach the shop, as far as it has been filled in.
 *
 * <b>Every field is optional and that is the point.</b> A shop that has not
 * entered its address yet gets a page without an address line rather than one
 * reading "Address: —", which looks like something failed to load.
 */
export interface ContactDetails {
  shopName?: string | null;

  /** For a person to read: <c>01712345678</c>. */
  phone?: string | null;

  /** For `tel:` and WhatsApp: <c>+8801712345678</c>. Absent if the shop typed something else. */
  phoneE164?: string | null;

  email?: string | null;
  address?: string | null;

  /** Opening hours and how quickly somebody replies, in the shop's own words. */
  hours?: string | null;
}

/** A message on its way to the shop. */
export interface SubmitContactMessage {
  name: string;

  /** Either this or `email`. The API insists on one. */
  phone?: string | null;
  email?: string | null;

  topic: ContactTopic;

  /** An order, quotation or booking number, if they have one to hand. */
  reference?: string | null;

  message: string;
}

/** What the customer is told after sending. */
export interface ContactReceipt {
  /** The phone or email they left, said back to them. */
  replyTo: string;

  hours?: string | null;
}

/** One line in the shop's inbox. */
export interface ContactMessageListItem {
  id: number;
  name: string;

  /** Masked: <c>017****5678</c>. The whole number is on the message itself. */
  phone?: string | null;
  email?: string | null;

  topic: ContactTopic;
  status: ContactMessageStatus;
  preview: string;
  reference?: string | null;
  receivedAt: string;
}

/** One message, opened. */
export interface ContactMessage {
  id: number;
  name: string;

  /** In full: this is the screen somebody rings from. */
  phone?: string | null;
  email?: string | null;

  topic: ContactTopic;
  status: ContactMessageStatus;
  message: string;
  reference?: string | null;
  staffNote?: string | null;
  receivedAt: string;
  answeredAt?: string | null;
}

/** Filters for the inbox. */
export interface ContactMessageQuery {
  status?: ContactMessageStatus | null;
  topic?: ContactTopic | null;
  term?: string | null;
  page?: number;
  pageSize?: number;
}

/** Moving a message along, and what staff want to remember about it. */
export interface UpdateContactMessage {
  status: ContactMessageStatus;
  staffNote?: string | null;
}
