import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AccountService } from '../../_services/account.service';
import { AdminNotificationService } from '../../_services/admin/admin-notification.service';
import { ToastService } from '../../_services/toast.service';
import {
  NotificationPreview,
  NotificationTemplateDetail
} from '../../_models/notifications';

/**
 * One message, as the customer will actually read it.
 *
 * <b>This is the message, not a description of it.</b> The API renders it
 * through the same code the delivery worker uses, from a sample order, so what
 * is on this page is what would arrive — down to the shop's telephone number
 * on the end, and down to the gap where that number should be if nobody has
 * filled it in yet.
 *
 * <b>Both languages, side by side, with their prices.</b> An SMS is billed per
 * part, and the part is 160 characters in English but 70 in Bangla. Seeing the
 * two forms together is the only way the difference is obvious, and the
 * difference is what the switch above them is deciding about.
 *
 * <b>The email is shown in a sandboxed frame.</b> Transactional email is a
 * table of inline styles, because that is what survives the mail clients
 * people actually read on — so it has to be rendered rather than described,
 * and rendering it anywhere it could touch the panel would be a poor trade for
 * that.
 */
@Component({
  selector: 'app-admin-notification-template',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="small text-muted text-decoration-none" routerLink="/admin/notifications">
      &lsaquo; All notifications
    </a>

    @if (loading()) {
      <p class="text-muted small mt-3">Loading…</p>
    } @else if (template(); as detail) {
      <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mb-1">
        <h1 class="h4 mb-0">{{ detail.name }}</h1>
        <span class="badge text-bg-light font-monospace fw-normal">{{ detail.code }}</span>
        @if (detail.audience === 'Shop') {
          <span class="badge text-bg-light fw-normal">To the shop</span>
        }
      </div>
      <p class="text-muted small mb-3">{{ detail.whenItFires }}</p>

      @if (refusal(); as message) {
        <div class="alert alert-warning" role="alert">{{ message }}</div>
      }

      @if (!detail.shopPhoneConfigured) {
        <!-- Said here as well as on the list, because this is the page where
             the gap is legible: the message below stops where the number
             should be. -->
        <div class="alert alert-warning small" role="alert">
          The shop has no telephone number set, which is why the message below ends
          where it does. <a routerLink="/admin/settings">Set it in Settings</a>.
        </div>
      }

      <div class="border rounded p-3 mb-3">
        <h2 class="h6 text-uppercase text-muted small mb-3">Is this sent?</h2>

        <div class="d-flex flex-wrap gap-4">
          <div class="form-check form-switch mb-0">
            <input
              id="smsEnabled"
              class="form-check-input"
              type="checkbox"
              role="switch"
              [checked]="detail.smsEnabled"
              [disabled]="!canWrite() || saving()"
              (change)="toggleSms()" />
            <label class="form-check-label small" for="smsEnabled">
              Send as a text message
              @if (!detail.smsGatewayConfigured) {
                <span class="text-warning"> — no gateway is configured</span>
              }
            </label>
          </div>

          <div class="form-check form-switch mb-0">
            <input
              id="emailEnabled"
              class="form-check-input"
              type="checkbox"
              role="switch"
              [checked]="detail.emailEnabled"
              [disabled]="!canWrite() || saving()"
              (change)="toggleEmail()" />
            <label class="form-check-label small" for="emailEnabled">
              Send as an email
              @if (!detail.emailConfigured) {
                <span class="text-muted"> — no mail server is configured</span>
              }
            </label>
          </div>
        </div>

        @if (!detail.smsEnabled && !detail.emailEnabled) {
          <div class="alert alert-secondary small mt-3 mb-0" role="note">
            Nothing goes out when this happens. The messages are still recorded on
            <a routerLink="/admin/notifications/messages">what has been sent</a>, so they
            can go later if this is turned back on.
          </div>
        }

        @if (!canWrite()) {
          <p class="form-text mb-0">
            Turning a message on or off is the owner's decision, so these are read-only
            for you.
          </p>
        }
      </div>

      @for (preview of detail.previews; track preview.language) {
        <div class="border rounded p-3 mb-3">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
            <h2 class="h6 mb-0">{{ languageName(preview) }}</h2>
            <span class="badge fw-normal" [class]="partClass(preview)">
              {{ parts(preview) }}
            </span>
            <span class="badge text-bg-light fw-normal">
              {{ preview.isUnicode ? '70 characters a part' : '160 characters a part' }}
            </span>
          </div>

          @if (preview.smsText) {
            <p class="form-label small text-muted mb-1">Text message</p>
            <!-- Fixed width and a monospace face on purpose: the length is the
                 thing being read here, and a proportional font hides it. -->
            <pre
              class="border rounded bg-light p-3 mb-2 small text-wrap"
              style="white-space: pre-wrap"
            >{{ preview.smsText }}</pre>
            <p class="form-text mb-0">
              {{ preview.smsText.length }} characters &middot; {{ parts(preview) }}
            </p>
          }

          @if (preview.emailSubject) {
            <p class="form-label small text-muted mt-3 mb-1">Email</p>
            <p class="fw-semibold mb-2">{{ preview.emailSubject }}</p>

            <!-- Sandboxed: no scripts, no navigation, no access to the panel
                 around it. The content comes from our own server and from a
                 sample rather than a customer, and it is still framed this way
                 because an email body is the one thing on this screen that is
                 rendered rather than printed. -->
            <iframe
              class="w-100 border rounded"
              style="height: 420px"
              sandbox
              [title]="'Email preview, ' + languageName(preview)"
              [srcdoc]="emailBody(preview)"></iframe>
          }
        </div>
      }

      <p class="form-text">
        Written from a sample order, by the same code that sends the real one. The
        wording lives in the shop's code rather than in a box on this page: each message
        is written to fit the fewest billed parts that still says the thing, in both
        languages.
      </p>
    } @else {
      <div class="border rounded p-5 text-center text-muted mt-3">
        <p class="mb-0">Nothing in the shop sends a message of that kind.</p>
      </div>
    }
  `
})
export class AdminNotificationTemplate {
  private readonly api = inject(AdminNotificationService);
  private readonly account = inject(AccountService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);

  protected readonly template = signal<NotificationTemplateDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly refusal = signal<string | null>(null);

  protected readonly canWrite = computed(() => this.account.hasAnyRole('Admin'));

  private readonly code = this.route.snapshot.paramMap.get('code') ?? '';

  constructor() {
    this.api.getTemplate(this.code).subscribe({
      next: detail => {
        this.template.set(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  protected languageName(preview: NotificationPreview): string {
    return preview.language === 'bn' ? 'In Bangla' : 'In English';
  }

  protected parts(preview: NotificationPreview): string {
    return `${preview.smsParts} billed part${preview.smsParts === 1 ? '' : 's'}`;
  }

  /**
   * One part is the ordinary case and needs no colour. Two is worth noticing;
   * three or more is a message somebody should look at again before paying for
   * it on every order.
   */
  protected partClass(preview: NotificationPreview): string {
    if (preview.smsParts >= 3) {
      return 'text-bg-warning';
    }

    return preview.smsParts === 1 ? 'text-bg-success' : 'text-bg-light';
  }

  protected emailBody(preview: NotificationPreview): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(preview.emailHtml ?? '');
  }

  protected toggleSms(): void {
    const detail = this.template();

    if (detail) {
      this.save(!detail.smsEnabled, detail.emailEnabled);
    }
  }

  protected toggleEmail(): void {
    const detail = this.template();

    if (detail) {
      this.save(detail.smsEnabled, !detail.emailEnabled);
    }
  }

  private save(smsEnabled: boolean, emailEnabled: boolean): void {
    this.saving.set(true);
    this.refusal.set(null);

    this.api.updateTemplate(this.code, { smsEnabled, emailEnabled }).subscribe({
      next: response => {
        this.saving.set(false);

        if (response.isSuccess && response.data) {
          this.template.set(response.data);
          this.toast.success('Saved.');

          return;
        }

        // Re-set the signal so the switch snaps back to what is stored. A
        // control left where somebody put it would have them believing a
        // message was off when it is not.
        this.refusal.set(response.message ?? 'That could not be saved.');
        this.template.set(this.template() ? { ...this.template()! } : null);
      },
      error: () => {
        this.saving.set(false);
        this.template.set(this.template() ? { ...this.template()! } : null);
      }
    });
  }
}
