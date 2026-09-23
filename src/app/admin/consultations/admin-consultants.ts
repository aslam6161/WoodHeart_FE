import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountService } from '../../_services/account.service';
import { AdminConsultationService } from '../../_services/admin/admin-consultation.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { Consultant, ConsultationService } from '../../_models/consultations';

/**
 * The people whose time is being sold.
 *
 * <b>Two things are flagged, because both mean an empty calendar.</b> A
 * designer who offers nothing, and one with no working week written. Either
 * way the booking page shows nothing and nobody can tell from the storefront
 * why — so the list that can tell says so.
 */
@Component({
  selector: 'app-admin-consultants',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="small text-muted text-decoration-none" routerLink="/admin/consultations">
      &lsaquo; Consultations
    </a>

    <div class="d-flex flex-wrap align-items-center gap-2 mt-2 mb-3">
      <h1 class="h4 mb-0">Designers</h1>
      <span class="badge text-bg-light">{{ consultants().length }}</span>

      @if (canWrite()) {
        <a class="btn btn-sm btn-dark ms-auto" routerLink="/admin/consultations/consultants/new">
          Add a designer
        </a>
      }
    </div>

    @if (loading()) {
      <p class="text-muted small">Loading…</p>
    } @else if (consultants().length === 0) {
      <div class="border rounded p-5 text-center text-muted">
        <p class="mb-3">
          Nobody is listed yet, so every consultation calendar is empty.
        </p>
        @if (canWrite()) {
          <a class="btn btn-dark" routerLink="/admin/consultations/consultants/new">
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
              <th scope="col">Offers</th>
              <th scope="col">Specialities</th>
              <th scope="col">Live</th>
            </tr>
          </thead>
          <tbody>
            @for (person of consultants(); track person.id) {
              <tr>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    @if (photo(person.photoPath); as src) {
                      <img class="rounded-circle border" [src]="src" alt="" width="32" height="32" />
                    }
                    @if (canWrite()) {
                      <a
                        class="fw-semibold text-decoration-none"
                        [routerLink]="['/admin/consultations/consultants', person.id]">
                        {{ person.name }}
                      </a>
                    } @else {
                      <span class="fw-semibold">{{ person.name }}</span>
                    }
                  </div>
                </td>

                <td class="small">
                  @if (person.serviceIds.length === 0) {
                    <span class="badge text-bg-warning fw-normal">nothing</span>
                  } @else {
                    {{ offers(person) }}
                  }
                </td>

                <td class="small text-muted">
                  {{ person.specialities.join(', ') || '—' }}
                </td>

                <td>
                  <span
                    class="badge fw-normal"
                    [class]="person.isActive ? 'text-bg-success' : 'text-bg-secondary'">
                    {{ person.isActive ? 'Live' : 'Off' }}
                  </span>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <p class="small text-muted mt-3 mb-0">
        A designer's working week is edited on their own page. Until one is written, nothing of
        theirs can be booked.
      </p>
    }
  `
})
export class AdminConsultants {
  private readonly api = inject(AdminConsultationService);
  private readonly account = inject(AccountService);
  private readonly media = inject(MediaUrlService);

  protected readonly consultants = signal<Consultant[]>([]);
  protected readonly services = signal<ConsultationService[]>([]);
  protected readonly loading = signal(true);

  protected readonly canWrite = computed(() => this.account.hasAnyRole('Admin', 'Manager'));

  constructor() {
    this.api.getConsultants().subscribe({
      next: people => {
        this.consultants.set(people);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    this.api.getServices().subscribe(services => this.services.set(services));
  }

  protected photo(path: string | null | undefined): string | null {
    return this.media.image(path, { width: 64, height: 64, fit: 'fill' });
  }

  protected offers(person: Consultant): string {
    const byId = new Map(this.services().map(service => [service.id, service.name]));

    return person.serviceIds.map(id => byId.get(id) ?? '—').join(', ');
  }
}
