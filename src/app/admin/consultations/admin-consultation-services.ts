import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
import { AdminConsultationService } from '../../_services/admin/admin-consultation.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { ADMIN_MODE_LABELS } from '../../_models/admin-consultations';
import { ConsultationMode, ConsultationService } from '../../_models/consultations';

/**
 * What the shop sells an hour of.
 *
 * <b>There is no delete.</b> A service that has been booked is part of a
 * year's bookings and of what those bookings were for, so switching it off is
 * how one goes away — the same rule as a discount. An inactive service
 * disappears from the storefront and keeps its history.
 *
 * <b>A service nobody offers is called out.</b> The calendar for it is empty
 * whatever its hours say, and "why can nobody book this" is otherwise half an
 * hour of looking in the wrong place.
 */
@Component({
  selector: 'app-admin-consultation-services',
  imports: [RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <a class="small text-muted text-decoration-none" routerLink="/admin/consultations">
        &lsaquo; Consultations
      </a>
    </div>

    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <h1 class="h4 mb-0">What we offer</h1>
      <span class="badge text-bg-light">{{ services().length }}</span>

      @if (canWrite()) {
        <a class="btn btn-sm btn-dark ms-auto" routerLink="/admin/consultations/services/new">
          Add a consultation
        </a>
      }
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (services().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-3">Nothing is on offer yet, so nobody can book anything.</p>
        @if (canWrite()) {
          <a class="btn btn-dark" routerLink="/admin/consultations/services/new">
            Add the first one
          </a>
        }
      </div>
    } @else {
      <div class="table-responsive border rounded">
        <table class="table table-hover align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Kind</th>
              <th scope="col">Length</th>
              <th scope="col">Designers</th>
              <th scope="col">Live</th>
              <th scope="col" class="text-end">Fee</th>
            </tr>
          </thead>
          <tbody>
            @for (service of services(); track service.id) {
              <tr>
                <td>
                  @if (canWrite()) {
                    <a
                      class="fw-semibold text-decoration-none"
                      [routerLink]="['/admin/consultations/services', service.id]">
                      {{ service.name }}
                    </a>
                  } @else {
                    <span class="fw-semibold">{{ service.name }}</span>
                  }
                  <div class="small text-muted font-monospace">{{ service.slug }}</div>
                </td>

                <td class="small">{{ modeLabel(service.mode) }}</td>

                <td class="small text-nowrap">{{ service.durationMinutes }} min</td>

                <td class="small">
                  @if (service.consultants.length === 0) {
                    <!-- Nothing can be booked, whatever the hours say. -->
                    <span class="badge text-bg-warning fw-normal">nobody offers it</span>
                  } @else {
                    {{ names(service) }}
                  }
                </td>

                <td>
                  <span
                    class="badge fw-normal"
                    [class]="service.isActive ? 'text-bg-success' : 'text-bg-secondary'">
                    {{ service.isActive ? 'Live' : 'Off' }}
                  </span>
                </td>

                <td class="text-end text-nowrap">
                  @if (service.fee > 0) {
                    {{ service.fee | taka }}
                    @if (service.advanceDue) {
                      <div class="small text-muted">{{ service.advanceDue | taka }} deposit</div>
                    }
                  } @else {
                    <span class="text-muted">Free</span>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <p class="small text-muted mt-3 mb-0">
        A consultation that has been booked is part of that booking's history, so there is no
        delete — switch one off and it leaves the storefront.
      </p>
    }
  `
})
export class AdminConsultationServices {
  private readonly api = inject(AdminConsultationService);
  private readonly account = inject(AccountService);

  protected readonly services = signal<ConsultationService[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.api.getServices().subscribe({
      next: services => {
        this.services.set(services);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  /** The API refuses a packer's write; the screen does not offer it either. */
  protected readonly canWrite = computed(() => this.account.hasAnyRole('Admin', 'Manager'));

  protected modeLabel(mode: ConsultationMode): string {
    return ADMIN_MODE_LABELS[mode] ?? mode;
  }

  protected names(service: ConsultationService): string {
    return service.consultants.map(person => person.name).join(', ');
  }
}
