import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ContactMessage, ContactMessageStatus } from '../../_models/contact';
import { AdminContactService } from '../../_services/admin/admin-contact.service';
import { ToastService } from '../../_services/toast.service';

/**
 * One message, and the two things staff do with it: answer it, and say so.
 *
 * <b>The number is whole here.</b> The list masks it because it is read over
 * somebody's shoulder; this is the screen the call is made from, and a number
 * nobody can dial is not a contact. It is a <c>tel:</c> link, because half of
 * this admin is used on a phone.
 *
 * <b>Opening this page is what marks the message read.</b> No button for it:
 * one that says "yes, I have read the thing on my screen" gets pressed on the
 * wrong rows, and then the unread count is not worth looking at.
 */
@Component({
  selector: 'app-admin-contact-detail',
  imports: [RouterLink, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="small text-decoration-none" routerLink="/admin/contact-messages">&larr; All messages</a>

    @if (loading()) {
      <p class="text-muted mt-3">Loading…</p>
    } @else if (message(); as item) {
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-2 mb-3">
        <h1 class="h4 mb-0">{{ item.name }}</h1>
        <span class="badge" [class]="badge(item.status)">{{ item.status }}</span>
      </div>

      <div class="row g-3">
        <div class="col-12 col-lg-7">
          <div class="card">
            <div class="card-body">
              <p class="text-muted small mb-2">
                {{ item.topic }} · {{ item.receivedAt | date: 'd MMM yyyy, h:mm a' }}
                @if (item.reference) {
                  · Ref <strong>{{ item.reference }}</strong>
                }
              </p>

              <!-- Whitespace preserved: somebody typed this in paragraphs and
                   collapsing them makes a complaint read as one long sentence. -->
              <p class="wh-message mb-0">{{ item.message }}</p>
            </div>
          </div>
        </div>

        <div class="col-12 col-lg-5">
          <div class="card mb-3">
            <div class="card-body">
              <h2 class="h6">Reply to</h2>

              @if (item.phone) {
                <p class="mb-1">
                  <a class="fs-5 text-decoration-none" [href]="'tel:' + item.phone">
                    {{ item.phone }}
                  </a>
                </p>
                <p class="mb-2">
                  <a
                    class="small"
                    [href]="'https://wa.me/' + whatsapp(item.phone)"
                    target="_blank"
                    rel="noopener">
                    WhatsApp
                  </a>
                </p>
              }

              @if (item.email) {
                <p class="mb-0">
                  <a [href]="'mailto:' + item.email">{{ item.email }}</a>
                </p>
              }

              @if (item.answeredAt) {
                <p class="text-success small mb-0 mt-2">
                  Answered {{ item.answeredAt | date: 'd MMM yyyy, h:mm a' }}
                </p>
              }
            </div>
          </div>

          <div class="card">
            <div class="card-body">
              <h2 class="h6">Mark it</h2>

              <div class="mb-2">
                <label class="form-label small mb-1" for="message-status">Status</label>
                <select id="message-status" class="form-select form-select-sm" [(ngModel)]="status">
                  <option value="New">New</option>
                  <option value="Read">Read</option>
                  <option value="Answered">Answered</option>
                  <option value="Spam">Spam</option>
                </select>
              </div>

              <div class="mb-2">
                <label class="form-label small mb-1" for="message-note">
                  Note <span class="text-muted">(staff only — the customer never sees this)</span>
                </label>
                <textarea
                  id="message-note"
                  class="form-control form-control-sm"
                  rows="3"
                  maxlength="1000"
                  [(ngModel)]="note"></textarea>
              </div>

              @if (error()) {
                <div class="alert alert-danger py-2 small" role="alert">{{ error() }}</div>
              }

              <button
                class="btn btn-dark btn-sm"
                type="button"
                [disabled]="saving()"
                (click)="save()">
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    } @else {
      <div class="alert alert-warning mt-3">That message is not in the inbox.</div>
    }
  `,
  styles: `
    .wh-message {
      white-space: pre-wrap;
    }
  `
})
export class AdminContactDetail implements OnInit {
  private readonly contact = inject(AdminContactService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly message = signal<ContactMessage | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected status: ContactMessageStatus = 'Read';
  protected note = '';

  private id = 0;

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));

    this.contact
      .get(this.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(message => {
        this.message.set(message);
        this.status = message?.status ?? 'Read';
        this.note = message?.staffNote ?? '';
        this.loading.set(false);
      });
  }

  /** Digits only: wa.me rejects the leading plus. */
  protected whatsapp(phone: string): string {
    return phone.replace(/\D/g, '');
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

  protected save(): void {
    this.error.set(null);
    this.saving.set(true);

    this.contact
      .update(this.id, { status: this.status, staffNote: this.note.trim() || null })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.saving.set(false);

          if (!response.isSuccess || !response.data) {
            this.error.set(response.message ?? 'That could not be saved.');
            return;
          }

          this.message.set(response.data);
          this.toast.success('Saved.');
        },
        error: () => {
          this.saving.set(false);
          this.error.set('That could not be saved.');
        }
      });
  }
}
