import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  numberAttribute,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminStockService } from '../../_services/admin/admin-stock.service';
import { AccountService } from '../../_services/account.service';
import { ToastService } from '../../_services/toast.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { GeneralResponse } from '../../_models/generalResponse';
import {
  MANUAL_MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  REASON_REQUIRED_TYPES,
  StockLevel,
  StockMovement,
  StockMovementType
} from '../../_models/inventory';

/**
 * One variant's stock: the count, the ledger that explains it, and the form
 * that moves it.
 *
 * <b>The ledger is the page.</b> The count at the top is only the sum of the
 * lines below it, and when the number on the shelf disagrees with the number
 * on the screen, the lines are how anybody finds out where it went. A
 * correction is one more line with a reason on it, never an edit to the
 * count.
 *
 * The form is shown to admins and managers. Every staff member can read the
 * page — the packer needs to know the bed is there — but a stock-in that did
 * not happen and a write-off that did are both money.
 */
@Component({
  selector: 'app-admin-stock-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav aria-label="Breadcrumb">
      <ol class="breadcrumb small">
        <li class="breadcrumb-item"><a routerLink="/admin/inventory/stock">Stock</a></li>
        <li class="breadcrumb-item active" aria-current="page">{{ level()?.sku ?? '…' }}</li>
      </ol>
    </nav>

    @if (level(); as item) {
      <div class="d-flex flex-wrap align-items-start gap-3 mb-4">
        @if (thumb(item); as src) {
          <img class="rounded border" [src]="src" alt="" width="72" height="72" />
        }
        <div class="flex-grow-1">
          <h1 class="h4 mb-0">{{ item.productName }}</h1>
          <div class="text-muted">
            {{ item.variantName }} &middot; <span class="font-monospace">{{ item.sku }}</span>
          </div>
          <a class="small text-decoration-none" [routerLink]="['/admin/products', item.productId, 'variants']">
            Edit the variant
          </a>
        </div>
      </div>

      <div class="row g-2 mb-4">
        <div class="col-4 col-md-3">
          <div class="border rounded p-2 px-3 h-100">
            <div class="text-uppercase text-muted small">On hand</div>
            <div class="fs-3">{{ item.isStocked ? item.onHand : '—' }}</div>
          </div>
        </div>
        <div class="col-4 col-md-3">
          <div class="border rounded p-2 px-3 h-100">
            <div class="text-uppercase text-muted small">Held for orders</div>
            <div class="fs-3 text-muted">{{ item.isStocked ? item.reserved : '—' }}</div>
          </div>
        </div>
        <div class="col-4 col-md-3">
          <div class="border rounded p-2 px-3 h-100" [class.border-danger]="item.isStocked && item.isLow">
            <div class="text-uppercase text-muted small">Available</div>
            <div class="fs-3" [class.text-danger]="item.isStocked && item.isLow">
              {{ item.isStocked ? item.available : '—' }}
            </div>
            @if (item.isStocked && item.isLow) {
              <span class="badge text-bg-danger">Low</span>
            }
          </div>
        </div>
        <div class="col-12 col-md-3">
          <div class="border rounded p-2 px-3 h-100">
            <div class="text-uppercase text-muted small">Reorder at</div>
            <div class="fs-3">{{ item.reorderLevel ?? '—' }}</div>
            @if (item.reorderLevel == null) {
              <span class="small text-muted">Store default applies</span>
            }
          </div>
        </div>
      </div>

      @if (!item.isStocked) {
        <div class="alert alert-warning py-2 small">
          This variant has never been stocked in, so the storefront shows it as sold out.
          @if (canWrite()) {
            Record the first stock-in below.
          }
        </div>
      }

      @if (canWrite()) {
        <section class="border rounded p-3 mb-4">
          <h2 class="h6 text-uppercase text-muted mb-3">Record a movement</h2>

          <form class="row g-2" [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="col-6 col-md-3">
              <label class="form-label small" for="movement-type">What happened</label>
              <select class="form-select" id="movement-type" formControlName="type">
                @for (type of types; track type) {
                  <option [value]="type">{{ typeLabel(type) }}</option>
                }
              </select>
            </div>

            <div class="col-6 col-md-2">
              <label class="form-label small" for="movement-quantity">How many</label>
              <input
                class="form-control"
                id="movement-quantity"
                type="number"
                inputmode="numeric"
                [step]="1"
                formControlName="quantity"
                [class.is-invalid]="invalid('quantity')" />
              @if (invalid('quantity')) {
                <div class="invalid-feedback">{{ quantityError() }}</div>
              }
            </div>

            <div class="col-12 col-md-4">
              <label class="form-label small" for="movement-reason">
                Why {{ reasonRequired() ? '' : '(optional)' }}
              </label>
              <input
                class="form-control"
                id="movement-reason"
                type="text"
                maxlength="500"
                formControlName="reason"
                [class.is-invalid]="invalid('reason')"
                [placeholder]="reasonPlaceholder()" />
              @if (invalid('reason')) {
                <div class="invalid-feedback">{{ serverError('reason') ?? 'Say why.' }}</div>
              }
            </div>

            <div class="col-8 col-md-3">
              <label class="form-label small" for="movement-reference">Reference (optional)</label>
              <input
                class="form-control"
                id="movement-reference"
                type="text"
                maxlength="120"
                formControlName="reference"
                placeholder="Invoice or delivery note" />
            </div>

            <div class="col-4 col-md-2">
              <label class="form-label small" for="movement-reorder">Reorder at</label>
              <input
                class="form-control"
                id="movement-reorder"
                type="number"
                inputmode="numeric"
                min="0"
                formControlName="reorderLevel"
                [placeholder]="'Store default'"
                [class.is-invalid]="invalid('reorderLevel')" />
            </div>

            @if (form.controls.type.value === 'Adjustment') {
              <div class="col-12 small text-muted">
                A correction is signed: <code>-2</code> means two fewer than the system said.
              </div>
            }

            @if (failure(); as message) {
              <div class="col-12">
                <div class="alert alert-danger py-2 small mb-0" role="alert">{{ message }}</div>
              </div>
            }

            <div class="col-12">
              <button class="btn btn-dark" type="submit" [disabled]="saving()">
                {{ saving() ? 'Recording…' : 'Record' }}
              </button>
            </div>
          </form>
        </section>
      }

      <section>
        <div class="d-flex align-items-center gap-2 mb-2">
          <h2 class="h6 text-uppercase text-muted mb-0">Ledger</h2>
          <span class="badge text-bg-light">{{ total() }}</span>
        </div>

        @if (movements().length === 0) {
          <p class="text-muted small">Nothing has moved yet.</p>
        } @else {
          <div class="table-responsive border rounded">
            <table class="table table-sm align-middle mb-0">
              <thead class="table-light">
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">What</th>
                  <th scope="col" class="text-end">Qty</th>
                  <th scope="col" class="text-end">On hand after</th>
                  <th scope="col">Why / reference</th>
                  <th scope="col">By</th>
                </tr>
              </thead>
              <tbody>
                @for (row of movements(); track row.id) {
                  <tr>
                    <td class="small text-nowrap">{{ row.occurredAt | date: 'd MMM yyyy, h:mm a' }}</td>
                    <td>
                      <span class="badge" [class]="typeClass(row.type)">{{ typeLabel(row.type) }}</span>
                    </td>
                    <td class="text-end font-monospace" [class.text-danger]="row.quantity < 0">
                      {{ row.quantity > 0 ? '+' + row.quantity : row.quantity }}
                    </td>
                    <td class="text-end font-monospace">{{ row.onHandAfter }}</td>
                    <td class="small">
                      @if (row.orderNumber; as orderNumber) {
                        <a class="font-monospace text-decoration-none" [routerLink]="['/admin/orders', orderNumber]">
                          {{ orderNumber }}
                        </a>
                      }
                      @if (row.reason) {
                        <div>{{ row.reason }}</div>
                      }
                      @if (row.reference) {
                        <div class="text-muted">{{ row.reference }}</div>
                      }
                    </td>
                    <td class="small text-muted">{{ row.performedBy }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (totalPages() > 1) {
            <nav class="d-flex align-items-center gap-2 mt-3" aria-label="Ledger pages">
              <button class="btn btn-sm btn-outline-secondary" type="button" [disabled]="page() <= 1" (click)="goTo(page() - 1)">
                Newer
              </button>
              <span class="small text-muted">Page {{ page() }} of {{ totalPages() }}</span>
              <button class="btn btn-sm btn-outline-secondary" type="button" [disabled]="page() >= totalPages()" (click)="goTo(page() + 1)">
                Older
              </button>
            </nav>
          }
        }
      </section>
    } @else if (!loading()) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-2">That variant is not stocked — it may be made to order, or switched off.</p>
        <a class="btn btn-sm btn-outline-secondary" routerLink="/admin/inventory/stock">Back to stock</a>
      </div>
    } @else {
      <p class="text-muted small">Loading…</p>
    }
  `
})
export class AdminStockDetail implements OnInit {
  private readonly stockApi = inject(AdminStockService);
  private readonly account = inject(AccountService);
  private readonly toast = inject(ToastService);
  private readonly media = inject(MediaUrlService);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  private static readonly PageSize = 50;

  /** Bound from the route by `withComponentInputBinding`. */
  readonly variantId = input.required<number, string>({ transform: numberAttribute });

  protected readonly level = signal<StockLevel | null>(null);
  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly failure = signal<string | null>(null);

  private readonly fieldErrors = signal<Record<string, string[]>>({});

  protected readonly types = MANUAL_MOVEMENT_TYPES;

  protected readonly canWrite = computed(() => this.account.hasAnyRole('Admin', 'Manager'));

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / AdminStockDetail.PageSize))
  );

  protected readonly form = this.formBuilder.group({
    type: this.formBuilder.control<StockMovementType>('Purchase'),
    quantity: this.formBuilder.control<number | null>(null, [Validators.required, Validators.pattern(/^-?\d+$/)]),
    reason: this.formBuilder.control(''),
    reference: this.formBuilder.control(''),
    reorderLevel: this.formBuilder.control<number | null>(null, [Validators.min(0)])
  });

  private readonly type = signal<StockMovementType>('Purchase');

  protected readonly reasonRequired = computed(() => REASON_REQUIRED_TYPES.has(this.type()));

  protected readonly reasonPlaceholder = computed(() => {
    switch (this.type()) {
      case 'Purchase':
        return 'Delivered from the workshop';
      case 'Damage':
        return 'What happened to it';
      case 'Adjustment':
        return 'What the count was checked against';
      case 'Return':
        return 'Returned by a customer';
      default:
        return '';
    }
  });

  constructor() {
    this.form.controls.type.valueChanges.subscribe(type => {
      this.type.set(type);

      // "Why" becomes mandatory when the type is a write-off or a correction.
      // The API refuses without it; asking first is kinder than a 400.
      const reason = this.form.controls.reason;

      reason.setValidators(REASON_REQUIRED_TYPES.has(type) ? [Validators.required] : []);
      reason.updateValueAndValidity({ emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.loadLevel();
    this.loadMovements();
  }

  protected thumb(item: StockLevel): string | null {
    return item.imagePath ? this.media.image(item.imagePath, { width: 144, height: 144, fit: 'fill' }) : null;
  }

  protected typeLabel(type: StockMovementType): string {
    return MOVEMENT_TYPE_LABELS[type] ?? type;
  }

  protected typeClass(type: StockMovementType): string {
    switch (type) {
      case 'Purchase':
      case 'TransferIn':
        return 'text-bg-success';
      case 'Return':
        return 'text-bg-info';
      case 'Sale':
        return 'text-bg-primary';
      case 'Damage':
        return 'text-bg-danger';
      case 'TransferOut':
        return 'text-bg-secondary';
      case 'Adjustment':
        return 'text-bg-warning';
      default:
        return 'text-bg-light';
    }
  }

  protected invalid(name: 'quantity' | 'reason' | 'reorderLevel'): boolean {
    const control = this.form.controls[name] as FormControl;

    return (control.invalid && control.touched) || !!this.fieldErrors()[name];
  }

  protected serverError(name: string): string | null {
    return this.fieldErrors()[name]?.[0] ?? null;
  }

  protected quantityError(): string {
    return (
      this.serverError('quantity') ??
      (this.type() === 'Adjustment' ? 'A whole number, signed.' : 'A whole number of at least one.')
    );
  }

  protected goTo(page: number): void {
    this.page.set(page);
    this.loadMovements();
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    this.failure.set(null);
    this.fieldErrors.set({});

    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();

    this.saving.set(true);

    this.stockApi
      .adjust(this.variantId(), {
        type: value.type,
        quantity: Number(value.quantity),
        reason: value.reason.trim() || null,
        reference: value.reference.trim() || null,
        reorderLevel: value.reorderLevel == null ? null : Number(value.reorderLevel)
      })
      .subscribe({
        next: response => {
          this.saving.set(false);

          if (response.data) {
            this.level.set(response.data);
          }

          this.form.reset({ type: value.type, quantity: null, reason: '', reference: '', reorderLevel: null });
          this.toast.success(response.message || 'Recorded.');

          // Back to the first page: the line just written is the newest.
          this.page.set(1);
          this.loadMovements();
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);

          const body = error.error as GeneralResponse | undefined;

          // The interceptor has toasted the headline; keep it beside the form
          // and mark the field the API named.
          this.fieldErrors.set(body?.errors ?? {});
          this.failure.set(body?.message ?? 'That could not be recorded.');
        }
      });
  }

  private loadLevel(): void {
    this.stockApi.level(this.variantId()).subscribe({
      next: item => {
        this.level.set(item);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private loadMovements(): void {
    this.stockApi.movements(this.variantId(), this.page(), AdminStockDetail.PageSize).subscribe(result => {
      this.movements.set(result.items);
      this.total.set(result.total);
    });
  }
}
