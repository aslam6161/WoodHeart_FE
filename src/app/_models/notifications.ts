/**
 * What the shop says, and what became of each message it tried to send.
 * Mirrors `NotificationAdminDtos.cs`.
 *
 * <b>There is no wording on any shape here, and that is deliberate.</b> An SMS
 * in this market is billed per part — 160 characters in English, but only 70
 * once a single Bangla character appears — and every message is written to fit
 * the fewest parts that still says the thing, in both languages. The API hands
 * this client the rendered message and its part count so the cost is visible
 * at the moment of the decision; what it takes back is the decision, which is
 * whether to send it at all and by which channel.
 */

/** Who a message is written for. */
export type NotificationAudience = 'Customer' | 'Shop';

/**
 * Where an outbox message got to.
 *
 * `Suppressed` is the one worth reading carefully: it means the message was
 * never sent and never will be, which is sometimes exactly what was asked for
 * — a template turned off — and sometimes a payload nothing could render. The
 * row's `lastError` is the only thing that tells the two apart.
 */
export type OutboxStatus =
  | 'Pending'
  | 'Processing'
  | 'Processed'
  | 'Failed'
  | 'Suppressed';

export const OUTBOX_STATUS_LABELS: Record<OutboxStatus, string> = {
  Pending: 'Queued',
  Processing: 'Sending',
  Processed: 'Sent',
  Failed: 'Gave up',
  Suppressed: 'Not sent'
};

/**
 * Colour per status.
 *
 * `Suppressed` is grey rather than red on purpose: most of them are messages
 * the shop chose not to send, and a wall of red would train somebody to stop
 * reading the one that is a genuine failure.
 */
export const OUTBOX_STATUS_CLASS: Record<OutboxStatus, string> = {
  Pending: 'text-bg-light',
  Processing: 'text-bg-info',
  Processed: 'text-bg-success',
  Failed: 'text-bg-danger',
  Suppressed: 'text-bg-secondary'
};

/** Everything the notifications screen needs to open. */
export interface NotificationTemplates {
  templates: NotificationTemplate[];

  /**
   * Whether an SMS gateway is actually configured.
   *
   * False selects a sender that writes the message to the log and reports
   * success — right on a developer's machine, and something to find out here
   * rather than from a customer.
   */
  smsGatewayConfigured: boolean;

  emailConfigured: boolean;

  /**
   * Whether the shop's telephone number has been set.
   *
   * Every message ends with it. Unset, the confirmation stops mid-sentence and
   * the email says "Any questions, please call ." — to every customer, on
   * every order, and nothing anywhere complains. The previews on this screen
   * are the only place that gap is visible.
   */
  shopPhoneConfigured: boolean;
}

export interface NotificationTemplate {
  /** `order.placed`. Fixed: it is the join to the code that renders it. */
  code: string;

  /** "Order confirmation", not "order.placed". */
  name: string;

  whenItFires: string;

  audience: NotificationAudience;

  smsEnabled: boolean;
  emailEnabled: boolean;

  /**
   * Billed parts for one English message.
   *
   * On the list, not only the preview, because the list is where a shop
   * decides what it is paying for.
   */
  smsParts: number;

  /** Billed parts in Bangla. Absent where the message has no Bangla form. */
  banglaSmsParts?: number | null;
}

export interface NotificationTemplateDetail extends NotificationTemplate {
  previews: NotificationPreview[];
  smsGatewayConfigured: boolean;
  emailConfigured: boolean;
  shopPhoneConfigured: boolean;
}

/** One template, rendered from a sample by the same code the worker uses. */
export interface NotificationPreview {
  language: 'en' | 'bn';
  smsText?: string | null;
  smsParts: number;
  /** True once one non-ASCII character drops the part size from 160 to 70. */
  isUnicode: boolean;
  emailSubject?: string | null;
  emailHtml?: string | null;
}

/** The only two things about a template that are the shop's to decide. */
export interface UpdateNotificationTemplate {
  smsEnabled: boolean;
  emailEnabled: boolean;
}

export interface NotificationMessage {
  id: number;
  type: string;
  /** The template's readable name, where the type is one we know. */
  templateName?: string | null;
  status: OutboxStatus;
  /** The order, booking or quotation number this message is about. */
  reference?: string | null;
  /** Masked. A list of failures should name nobody in full. */
  recipient?: string | null;
  attemptCount: number;
  createdAt: string;
  /** Set on a reminder held until the day before the appointment. */
  notBefore?: string | null;
  nextAttemptAt?: string | null;
  processedAt?: string | null;
  /** Why it failed, or why it was skipped. The most useful column here. */
  lastError?: string | null;
  correlationId?: string | null;
  /** False for one already queued or one a worker is holding. */
  canResend: boolean;
}

export interface NotificationMessageQuery {
  term?: string | null;
  status?: OutboxStatus | null;
  type?: string | null;
  page?: number;
  pageSize?: number;
}
