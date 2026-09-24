import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminNotificationService } from '../../_services/admin/admin-notification.service';
import { ToastService } from '../../_services/toast.service';
import {
  NotificationMessage,
  NotificationTemplate,
  OUTBOX_STATUS_CLASS,
  OUTBOX_STATUS_LABELS,
  OutboxStatus
} from '../../_models/notifications';

/**
 * What became of every message the shop tried to send.
 *
 * <b>This is the answer to "I never got a text about my order".</b> Which is
 * why it is searchable by the order, booking or quotation number rather than
 * by anything internal, and why reading it is open to every staff role: the
 * person being asked is whoever answered the telephone.
 *
 * <b>"Not sent" and "gave up" are different things and are coloured
 * differently.</b> A suppressed message is usually one the shop chose not to
 * send — a template switched off, a status nobody writes words for — and
 * painting those red would train somebody to stop reading the row that is a
 * real failure. The reason is on the row either way, because it is the only
 * thing that tells them apart.
 *
 * <b>Send again is offered only where it would do something.</b> A message
 * still queued is already on its way, and one a worker is holding is moments
 * from the gateway; the API refuses both, and a button that looked pressable
 * and then said no would be worse than none.
 */
@Component({
  selector: 'app-admin-notification-message-list',
  imports: [FormsModule, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
      <h1 class="h4 mb-0">What has been sent</h1>
      <span class="badge text-bg-light">{{ total() }}</span>
      <a class="btn btn-sm btn-outline-dark ms-auto" routerLink="/admin/notifications">
        Notification settings
      </a>
    </div>
    <p class="text-muted small mb-3">
      Every text message and email the shop has tried to send, newest first. Search by
      an order, booking or quotation number.
    </p>

    <div class="row g-2 mb-3">
      <div class="col-12 col-md-5">
        <input
          class="form-control"
          type="search"
          placeholder="Order, booking or quotation number"
          aria-label="Search messages"
          [ngModel]="term()"
          (ngModelChange)="onSearch($event)" />
      </div>

      <div class="col-12 col-md-3">
        <select
          class="form-select"
          aria-label="What happened"
          [ngModel]="status()"
          (ngModelChange)="onStatus($event)">
          <option [ngValue]="null">Anything</option>
          @for (option of statuses; track option) {
            <option [ngValue]="option">{{ label(option) }}</option>
          }
        </select>
      </div>

      <div class="col-12 col-md-4">
        <select
          class="form-select"
          aria-label="Kind of message"
          [ngModel]="type()"
          (ngModelChange)="onType($event)">
          <option [ngValue]="null">Any message</option>
          @for (template of templates(); track template.code) {
            <option [ngValue]="template.code">{{ template.name }}</option>
          }
        </select>
      </div>
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (messages().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-1">
          @if (term()) {
            Nothing was sent about "{{ term() }}".
          } @else if (status() || type()) {
            Nothing matches that.
          } @else {
            Nothing has been sent yet.
          }
        </p>
        @if (term()) {
          <p class="small mb-0">
            Either the number is wrong, or nothing has happened to it that the shop
            writes about.
          </p>
        }
      </div>
    } @else {
      <div class="table-responsive border rounded">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col">About</th>
              <th scope="col">Message</th>
              <th scope="col">What happened</th>
              <th scope="col">When</th>
              <th scope="col" class="text-end">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            @for (message of messages(); track message.id) {
              <tr [class.table-danger]="message.status === 'Failed'">
                <td>
                  <span class="fw-semibold font-monospace small">
                    {{ message.reference ?? '—' }}
                  </span>
                  @if (message.recipient) {
                    <div class="small text-muted">{{ message.recipient }}</div>
                  }
                </td>

                <td>
                  {{ message.templateName ?? message.type }}
                  @if (!message.templateName) {
                    <!-- A row from an older version of the code, or one whose
                         template has since been removed. It is still a real
                         message that was or was not sent. -->
                    <div class="small text-muted font-monospace">{{ message.type }}</div>
                  }
                </td>

                <td>
                  <span class="badge fw-normal" [class]="statusClass(message.status)">
                    {{ label(message.status) }}
                  </span>
                  @if (message.attemptCount > 1) {
                    <span class="small text-muted ms-1">
                      after {{ message.attemptCount }} tries
                    </span>
                  }
                  @if (message.lastError) {
                    <!-- The single most useful thing on the row. It is what
                         separates "the shop chose not to" from "the gateway
                         refused". -->
                    <div class="small text-muted">{{ message.lastError }}</div>
                  }
                </td>

                <td class="text-nowrap small">
                  {{ message.createdAt | date: 'd MMM, h:mm a' : '+0600' }}
                  @if (message.status === 'Pending' && message.notBefore) {
                    <div class="text-muted">
                      held until {{ message.notBefore | date: 'd MMM, h:mm a' : '+0600' }}
                    </div>
                  } @else if (message.processedAt) {
                    <div class="text-muted">
                      {{ message.processedAt | date: 'd MMM, h:mm a' : '+0600' }}
                    </div>
                  }
                </td>

                <td class="text-end">
                  @if (message.canResend) {
                    <button
                      class="btn btn-sm btn-outline-dark"
                      type="button"
                      [disabled]="resending() === message.id"
                      (click)="resend(message)">
                      {{ resending() === message.id ? 'Sending…' : 'Send again' }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (totalPages() > 1) {
        <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Message pages">
          <button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            [disabled]="page() <= 1"
            (click)="goTo(page() - 1)">
            Previous
          </button>
          <span class="small text-muted">Page {{ page() }} of {{ totalPages() }}</span>
          <button
            class="btn btn-sm btn-outline-secondary"
            type="button"
            [disabled]="page() >= totalPages()"
            (click)="goTo(page() + 1)">
            Next
          </button>
        </nav>
      }

      <p class="form-text mt-3">
        Sending again queues the same message to the same person. One that is already
        queued, or one a worker is sending right now, has no button: pressing it would
        either do nothing or send the message twice.
      </p>
    }
  `
})
export class AdminNotificationMessageList {
  private readonly api = inject(AdminNotificationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);

  private static readonly PageSize = 20;

  protected readonly statuses: readonly OutboxStatus[] = [
    'Pending',
    'Processing',
    'Processed',
    'Failed',
    'Suppressed'
  ];

  protected readonly messages = signal<NotificationMessage[]>([]);
  protected readonly templates = signal<NotificationTemplate[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly term = signal('');
  protected readonly status = signal<OutboxStatus | null>(null);
  protected readonly type = signal<string | null>(null);
  protected readonly resending = signal<number | null>(null);

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / AdminNotificationMessageList.PageSize))
  );

  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const status = this.route.snapshot.queryParamMap.get('status') as OutboxStatus | null;

    if (status && this.statuses.includes(status)) {
      this.status.set(status);
    }

    const term = this.route.snapshot.queryParamMap.get('term');

    if (term) {
      this.term.set(term);
    }

    // The filter names each message the way the settings screen does. Without
    // it the dropdown would read "order.status_changed".
    this.api.getTemplates().subscribe({
      next: result => this.templates.set(result.templates),
      error: () => this.templates.set([])
    });

    this.load();
  }

  protected label(status: OutboxStatus): string {
    return OUTBOX_STATUS_LABELS[status] ?? status;
  }

  protected statusClass(status: OutboxStatus): string {
    return OUTBOX_STATUS_CLASS[status] ?? 'text-bg-secondary';
  }

  protected onSearch(value: string): void {
    this.term.set(value);

    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      this.sync();
      this.load();
    }, 300);
  }

  protected onStatus(status: OutboxStatus | null): void {
    this.status.set(status);
    this.page.set(1);
    this.sync();
    this.load();
  }

  protected onType(type: string | null): void {
    this.type.set(type);
    this.page.set(1);
    this.load();
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected resend(message: NotificationMessage): void {
    this.resending.set(message.id);

    this.api.resend(message.id).subscribe({
      next: response => {
        this.resending.set(null);

        if (!response.isSuccess || !response.data) {
          this.toast.error(response.message ?? 'That could not be sent again.');

          // Whatever the refusal was, this row's state is not what the screen
          // thought it was. Reloading is cheaper than guessing.
          this.load();

          return;
        }

        const saved = response.data;

        this.messages.set(
          this.messages().map(m => (m.id === saved.id ? { ...m, ...saved } : m))
        );

        this.toast.success('Queued. It will go within the minute.');
      },
      error: () => {
        this.resending.set(null);
        this.load();
      }
    });
  }

  /** Status and search in the URL, so "everything that failed" can be sent on. */
  private sync(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { status: this.status(), term: this.term() || null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  private load(): void {
    this.loading.set(true);

    this.api
      .searchMessages({
        term: this.term() || null,
        status: this.status(),
        type: this.type(),
        page: this.page(),
        pageSize: AdminNotificationMessageList.PageSize
      })
      .subscribe({
        next: result => {
          this.messages.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
  }
}
