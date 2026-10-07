import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ContactMessageListItem,
  ContactMessageStatus,
  ContactTopic
} from '../../_models/contact';
import { AdminContactService } from '../../_services/admin/admin-contact.service';

const Statuses: ContactMessageStatus[] = ['New', 'Read', 'Answered', 'Spam'];

const Topics: ContactTopic[] = [
  'General',
  'Order',
  'Delivery',
  'Product',
  'Consultation',
  'Complaint'
];

/**
 * The shop's inbox.
 *
 * <b>Spam is out of the default list.</b> Junk that stays in it is junk
 * somebody scrolls past every morning, and a list people scroll past is a list
 * they stop reading. It is there under its own filter, because the one that
 * matters is the real customer marked as junk by accident.
 *
 * <b>Numbers are masked here and whole on the message.</b> This screen is read
 * over somebody's shoulder in an office; the message is the one they ring from.
 */
@Component({
  selector: 'app-admin-contact-list',
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <h1 class="h4 mb-0">Messages</h1>

      @if (contact.newCount() > 0) {
        <span class="badge text-bg-warning">{{ contact.newCount() }} unread</span>
      }
    </div>

    <div class="card mb-3">
      <div class="card-body row g-2 align-items-end">
        <div class="col-12 col-md-4">
          <label class="form-label small mb-1" for="inbox-term">Search</label>
          <input
            id="inbox-term"
            class="form-control form-control-sm"
            type="search"
            placeholder="Name, number, message, order…"
            [value]="term()"
            (change)="onTerm($event)" />
        </div>

        <div class="col-6 col-md-3">
          <label class="form-label small mb-1" for="inbox-status">Status</label>
          <select
            id="inbox-status"
            class="form-select form-select-sm"
            [value]="status() ?? ''"
            (change)="onStatus($event)">
            <option value="">Everything but spam</option>
            @for (value of statuses; track value) {
              <option [value]="value">{{ value }}</option>
            }
          </select>
        </div>

        <div class="col-6 col-md-3">
          <label class="form-label small mb-1" for="inbox-topic">Topic</label>
          <select
            id="inbox-topic"
            class="form-select form-select-sm"
            [value]="topic() ?? ''"
            (change)="onTopic($event)">
            <option value="">Any</option>
            @for (value of topics; track value) {
              <option [value]="value">{{ value }}</option>
            }
          </select>
        </div>

        <div class="col-12 col-md-2">
          <button class="btn btn-outline-secondary btn-sm w-100" type="button" (click)="clear()">
            Clear
          </button>
        </div>
      </div>
    </div>

    @if (loading()) {
      <p class="text-muted">Loading…</p>
    } @else if (messages().length === 0) {
      <div class="card">
        <div class="card-body text-center text-muted py-5">
          <p class="mb-1">Nothing here.</p>
          <p class="small mb-0">Messages sent from the contact page arrive in this list.</p>
        </div>
      </div>
    } @else {
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">Message</th>
              <th scope="col">Topic</th>
              <th scope="col">Received</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            @for (message of messages(); track message.id) {
              <tr [class.fw-semibold]="message.status === 'New'">
                <td>
                  <a class="text-decoration-none" [routerLink]="['/admin/contact-messages', message.id]">
                    {{ message.name }}
                  </a>
                  <div class="small text-muted">
                    {{ message.phone || message.email }}
                  </div>
                </td>

                <td class="small">
                  {{ message.preview }}
                  @if (message.reference) {
                    <div class="text-muted">Ref {{ message.reference }}</div>
                  }
                </td>

                <td class="small">{{ message.topic }}</td>

                <td class="small text-muted">{{ message.receivedAt | date: 'd MMM, h:mm a' }}</td>

                <td>
                  <span class="badge" [class]="badge(message.status)">{{ message.status }}</span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (pages() > 1) {
        <nav class="d-flex align-items-center gap-2">
          <button
            class="btn btn-outline-secondary btn-sm"
            type="button"
            [disabled]="page() === 1"
            (click)="go(page() - 1)">
            Previous
          </button>

          <span class="small text-muted">Page {{ page() }} of {{ pages() }}</span>

          <button
            class="btn btn-outline-secondary btn-sm"
            type="button"
            [disabled]="page() >= pages()"
            (click)="go(page() + 1)">
            Next
          </button>
        </nav>
      }
    }
  `
})
export class AdminContactList implements OnInit {
  protected readonly contact = inject(AdminContactService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statuses = Statuses;
  protected readonly topics = Topics;

  protected readonly messages = signal<ContactMessageListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly pages = signal(1);
  protected readonly term = signal('');
  protected readonly status = signal<ContactMessageStatus | null>(null);
  protected readonly topic = signal<ContactTopic | null>(null);

  ngOnInit(): void {
    this.contact.refreshCount();
    this.load();
  }

  protected onTerm(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value.trim());
    this.go(1);
  }

  protected onStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.status.set(value ? (value as ContactMessageStatus) : null);
    this.go(1);
  }

  protected onTopic(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.topic.set(value ? (value as ContactTopic) : null);
    this.go(1);
  }

  protected clear(): void {
    this.term.set('');
    this.status.set(null);
    this.topic.set(null);
    this.go(1);
  }

  protected go(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected badge(status: ContactMessageStatus): string {
    switch (status) {
      case 'New':
        return 'text-bg-warning';
      case 'Answered':
        return 'text-bg-success';
      case 'Spam':
        return 'text-bg-secondary';
      default:
        return 'text-bg-light';
    }
  }

  private load(): void {
    this.loading.set(true);

    this.contact
      .search({
        page: this.page(),
        status: this.status(),
        topic: this.topic(),
        term: this.term() || null
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        this.messages.set(result.items);
        this.pages.set(Math.max(1, Math.ceil(result.total / (result.pageSize || 20))));
        this.loading.set(false);
      });
  }
}
