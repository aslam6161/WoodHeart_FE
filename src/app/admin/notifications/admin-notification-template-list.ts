import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
import { AdminNotificationService } from '../../_services/admin/admin-notification.service';
import { ToastService } from '../../_services/toast.service';
import { NotificationTemplate } from '../../_models/notifications';

/**
 * What the shop tells people, and what each message costs to send.
 *
 * <b>The part count is the decision, so it is on the row.</b> An SMS is billed
 * per part: 160 characters in English, but only 70 once a single Bangla
 * character appears, which makes the Bangla form of a one-part confirmation
 * two or three. A shop choosing which messages are worth paying for cannot
 * make that call from a template name, and it is not a call anybody should
 * make by sending one and reading next month's invoice.
 *
 * <b>The wording is not editable and the screen says so.</b> Every message is
 * written to fit the fewest parts that still says the thing, in both
 * languages; a text box here would let an afternoon's editing triple the bill
 * with nothing anywhere to say it had. What is editable is the decision the
 * wording cannot make — whether to send it at all, and by which channel.
 *
 * <b>Both channels off is a real choice, and it is spelled out.</b> It means
 * nobody is told when that thing happens, which is sometimes exactly right
 * and never something to discover by accident.
 */
@Component({
  selector: 'app-admin-notification-template-list',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
      <h1 class="h4 mb-0">Notifications</h1>
      <a class="btn btn-sm btn-outline-dark ms-auto" routerLink="/admin/notifications/messages">
        What has been sent
      </a>
    </div>
    <p class="text-muted small mb-3">
      Every message the shop sends, and what each one costs. The wording is part of the
      shop's code — what is decided here is whether a message goes out, and how.
    </p>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else {
      @if (!smsConfigured()) {
        <!-- The sender that stands in for a missing gateway reports success,
             so nothing else in the application would ever mention this. -->
        <div class="alert alert-warning small" role="alert">
          <strong>No SMS gateway is configured.</strong> Messages are written to the
          server log and recorded as sent, but nothing reaches a customer's telephone.
        </div>
      }

      @if (!shopPhoneConfigured()) {
        <!-- Every message ends with it, so unset it is not a missing detail:
             the confirmation stops mid-sentence and the email says "Any
             questions, please call ." to every customer on every order. Read
             any message below and the gap is there. -->
        <div class="alert alert-warning small" role="alert">
          <strong>The shop has no telephone number set.</strong> Every message below
          ends with it, so as things stand each one arrives with nothing for the
          customer to call back on.
          <a routerLink="/admin/settings">Set it in Settings</a>.
        </div>
      }

      @if (!emailConfigured()) {
        <div class="alert alert-secondary small" role="note">
          No mail server is configured, so the email half of every message below goes
          nowhere. Most customers here read no email, which is why this is a note rather
          than a warning.
        </div>
      }

      <div class="row g-3">
        @for (template of templates(); track template.code) {
          <div class="col-12 col-xl-6">
            <div class="border rounded p-3 h-100">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                <h2 class="h6 mb-0">{{ template.name }}</h2>

                @if (template.audience === 'Shop') {
                  <!-- Worth distinguishing: turning this off means the shop
                       stops hearing about its own stock, and nobody outside
                       notices at all. -->
                  <span class="badge text-bg-light fw-normal">To the shop</span>
                }

                @if (silent(template)) {
                  <span class="badge text-bg-secondary fw-normal">Nobody is told</span>
                }

                <a
                  class="btn btn-sm btn-outline-dark ms-auto"
                  [routerLink]="['/admin/notifications/templates', template.code]">
                  Read it
                </a>
              </div>

              <p class="small text-muted mb-2">{{ template.whenItFires }}</p>

              <div class="d-flex flex-wrap gap-3 align-items-center">
                <div class="form-check form-switch mb-0">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    [id]="'sms-' + template.code"
                    [checked]="template.smsEnabled"
                    [disabled]="!canWrite() || saving() === template.code"
                    (change)="toggleSms(template)" />
                  <label class="form-check-label small" [for]="'sms-' + template.code">
                    Text message
                  </label>
                </div>

                <div class="form-check form-switch mb-0">
                  <input
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    [id]="'email-' + template.code"
                    [checked]="template.emailEnabled"
                    [disabled]="!canWrite() || saving() === template.code"
                    (change)="toggleEmail(template)" />
                  <label class="form-check-label small" [for]="'email-' + template.code">
                    Email
                  </label>
                </div>

                <span class="small text-muted ms-auto text-nowrap">{{ cost(template) }}</span>
              </div>

              @if (silent(template)) {
                <div class="alert alert-secondary small mt-3 mb-0" role="note">
                  Nothing goes out when this happens. The messages are still recorded, so
                  they can be sent later if this is turned back on.
                </div>
              }
            </div>
          </div>
        }
      </div>

      <p class="form-text mt-3">
        A text message is billed in parts: 160 characters in English, but only 70 once it
        contains a single Bangla character — so the Bangla form of a one-part message is
        usually two or three. Open a message to read exactly what it says.
      </p>

      @if (!canWrite()) {
        <p class="form-text">
          Turning a message on or off is the owner's decision, so these switches are
          read-only for you.
        </p>
      }
    }
  `
})
export class AdminNotificationTemplateList {
  private readonly api = inject(AdminNotificationService);
  private readonly account = inject(AccountService);
  private readonly toast = inject(ToastService);

  protected readonly templates = signal<NotificationTemplate[]>([]);
  protected readonly smsConfigured = signal(true);
  protected readonly emailConfigured = signal(true);
  protected readonly shopPhoneConfigured = signal(true);
  protected readonly loading = signal(true);

  /** The code currently in flight, so one row's switches lock and the rest do not. */
  protected readonly saving = signal<string | null>(null);

  /**
   * Reading is anybody's who answers the telephone; the switches are the
   * owner's, because they decide what the shop pays a gateway.
   */
  protected readonly canWrite = computed(() => this.account.hasAnyRole('Admin'));

  constructor() {
    this.load();
  }

  /** Both channels off: the thing happens and nobody hears about it. */
  protected silent(template: NotificationTemplate): boolean {
    return !template.smsEnabled && !template.emailEnabled;
  }

  /**
   * What one message costs, in the unit the gateway bills in.
   *
   * Said in full rather than as a number, because "2" beside a message means
   * nothing to somebody who has not been told what a part is.
   */
  protected cost(template: NotificationTemplate): string {
    if (!template.smsEnabled) {
      return 'No text message';
    }

    const english = `${template.smsParts} part${template.smsParts === 1 ? '' : 's'}`;

    return template.banglaSmsParts
      ? `${english} · ${template.banglaSmsParts} in Bangla`
      : english;
  }

  protected toggleSms(template: NotificationTemplate): void {
    this.save(template, { smsEnabled: !template.smsEnabled, emailEnabled: template.emailEnabled });
  }

  protected toggleEmail(template: NotificationTemplate): void {
    this.save(template, { smsEnabled: template.smsEnabled, emailEnabled: !template.emailEnabled });
  }

  private save(
    template: NotificationTemplate,
    dto: { smsEnabled: boolean; emailEnabled: boolean }
  ): void {
    this.saving.set(template.code);

    this.api.updateTemplate(template.code, dto).subscribe({
      next: response => {
        this.saving.set(null);

        if (!response.isSuccess || !response.data) {
          // The switch never moved in the model, so re-rendering puts the
          // control back where it was. Saying nothing here would leave
          // somebody believing they had turned a message off.
          this.toast.error(response.message ?? 'That could not be saved.');
          this.templates.set([...this.templates()]);

          return;
        }

        const saved = response.data;

        this.templates.set(
          this.templates().map(t => (t.code === saved.code ? { ...t, ...saved } : t))
        );
      },
      error: () => {
        this.saving.set(null);
        this.templates.set([...this.templates()]);
      }
    });
  }

  private load(): void {
    this.api.getTemplates().subscribe({
      next: result => {
        this.templates.set(result.templates);
        this.smsConfigured.set(result.smsGatewayConfigured);
        this.emailConfigured.set(result.emailConfigured);
        this.shopPhoneConfigured.set(result.shopPhoneConfigured);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }
}
