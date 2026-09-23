import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConsultationApiService } from '../../_services/consultation.service';
import { MediaUrlService } from '../../_services/media-url.service';
import { SeoService } from '../../_services/seo.service';
import { TakaPipe } from '../../_pipes/taka.pipe';
import { ConsultationService, MODE_LABELS } from '../../_models/consultations';

/**
 * "Talk to a designer" — what the shop sells an hour of.
 *
 * The second revenue line, and the one that needs the most explaining: a
 * customer browsing beds knows what a bed is. So each card says the three
 * things somebody decides on — where it happens, how long it takes, and what
 * it costs — rather than a paragraph of copy.
 *
 * <b>A free consultation says "Free", not "৳0".</b> Zero is a real and
 * deliberate option here, and rendering it as a price makes the shop look like
 * it forgot to set one.
 */
@Component({
  selector: 'app-consultation-list',
  imports: [RouterLink, TakaPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container py-4 py-md-5">
      <div class="row justify-content-center">
        <div class="col-12 col-lg-10">
          <h1 class="h3 mb-1">Talk to a designer</h1>
          <p class="text-muted mb-4">
            An hour with somebody who has furnished a hundred Dhaka flats. Bring photographs,
            measurements, or nothing at all.
          </p>

          @if (loading()) {
            <p class="text-muted small">Loading…</p>
          } @else if (services().length === 0) {
            <div class="border rounded p-5 text-center">
              <p class="mb-1">We are not taking consultations at the moment.</p>
              <p class="text-muted small mb-3">Please telephone us and we will arrange one.</p>
              <a class="btn btn-outline-dark" routerLink="/products">Browse the catalogue</a>
            </div>
          } @else {
            <div class="row g-3">
              @for (service of services(); track service.id) {
                <div class="col-12 col-md-6">
                  <div class="border rounded h-100 p-4 d-flex flex-column">
                    <div class="d-flex align-items-baseline gap-2 mb-2">
                      <h2 class="h5 mb-0">{{ service.name }}</h2>
                      <span class="badge text-bg-light fw-normal border">
                        {{ mode(service) }}
                      </span>
                    </div>

                    @if (service.description) {
                      <p class="text-muted small mb-3">{{ service.description }}</p>
                    }

                    <dl class="row small mb-3 gy-1">
                      <dt class="col-5 text-muted fw-normal">How long</dt>
                      <dd class="col-7 mb-0">{{ duration(service) }}</dd>

                      <dt class="col-5 text-muted fw-normal">Fee</dt>
                      <dd class="col-7 mb-0">
                        @if (service.fee > 0) {
                          {{ service.fee | taka }}
                        } @else {
                          <span class="text-success fw-semibold">Free</span>
                        }
                      </dd>

                      @if (service.advanceDue) {
                        <dt class="col-5 text-muted fw-normal">To confirm</dt>
                        <dd class="col-7 mb-0">
                          {{ service.advanceDue | taka }} in advance
                        </dd>
                      }
                    </dl>

                    @if (service.consultants.length > 0) {
                      <div class="d-flex align-items-center gap-2 mb-3">
                        @for (person of service.consultants; track person.id) {
                          @if (photo(person.photoPath); as src) {
                            <img
                              class="rounded-circle border"
                              [src]="src"
                              [alt]="person.name"
                              width="32"
                              height="32"
                              loading="lazy" />
                          }
                        }
                        <span class="small text-muted">{{ who(service) }}</span>
                      </div>
                    }

                    <div class="mt-auto">
                      @if (service.consultants.length > 0) {
                        <a class="btn btn-dark w-100" [routerLink]="['/consultation', service.slug]">
                          See available times
                        </a>
                      } @else {
                        <!-- No consultant offers it, so nothing can be booked.
                             Saying so beats a button that leads to an empty
                             calendar. -->
                        <button class="btn btn-outline-secondary w-100" type="button" disabled>
                          Not bookable at the moment
                        </button>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>

            <p class="small text-muted mt-4 mb-0">
              Already booked? <a routerLink="/consultation/find">Find your booking</a> with the
              number we sent you.
            </p>
          }
        </div>
      </div>
    </div>
  `
})
export class ConsultationList {
  private readonly api = inject(ConsultationApiService);
  private readonly media = inject(MediaUrlService);
  private readonly seo = inject(SeoService);

  protected readonly services = signal<ConsultationService[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    this.seo.apply({
      title: 'Talk to a designer',
      description:
        'Book an interior consultation with WoodHeart — online, at our studio, or at your own flat in Dhaka.',
      canonicalPath: '/consultation'
    });

    this.api.getServices().subscribe({
      next: services => {
        this.services.set(services);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  protected mode(service: ConsultationService): string {
    return MODE_LABELS[service.mode] ?? service.mode;
  }

  protected duration(service: ConsultationService): string {
    const minutes = service.durationMinutes;

    if (minutes < 60) {
      return `${minutes} minutes`;
    }

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    const hourLabel = hours === 1 ? '1 hour' : `${hours} hours`;

    return rest === 0 ? hourLabel : `${hourLabel} ${rest} minutes`;
  }

  protected who(service: ConsultationService): string {
    const names = service.consultants.map(person => person.name);

    return names.length === 1 ? `With ${names[0]}` : `With ${names.join(' or ')}`;
  }

  protected photo(path: string | null | undefined): string | null {
    return this.media.image(path, { width: 64, height: 64, fit: 'fill' });
  }
}
