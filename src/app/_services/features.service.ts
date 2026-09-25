import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { handledInline } from '../_interceptors/http-context';
import { GeneralResponseOf } from '../_models/generalResponse';
import { environment } from '../../environments/environment';

/** What the storefront may show. Mirrors `StorefrontFeaturesDto` on the API. */
export interface StorefrontFeatures {
  consultations: boolean;
}

/**
 * What the shop is offering at the moment.
 *
 * Read once and held in a signal, because it decides whether a link is drawn
 * in the header — asking again on every navigation would be a request per page
 * for an answer that changes when the shop owner throws a switch.
 *
 * The API refuses the work itself whatever this says. This is so the shop looks
 * deliberate rather than showing a link that fails when somebody follows it.
 */
@Injectable({ providedIn: 'root' })
export class FeaturesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /**
   * Starts true so the link is not hidden while the first request is in flight.
   *
   * A link that appears a moment after the page draws is worse than one that
   * was there all along: it moves what the reader was about to click. The shop
   * offers consultations far more often than it does not, so the optimistic
   * answer is right nearly always, and the pessimistic one would flicker on
   * every page load for everybody.
   */
  private readonly state = signal<StorefrontFeatures>({ consultations: true });

  readonly features = this.state.asReadonly();

  private loaded = false;

  /** A no-op after the first call, so the header may call it freely. */
  ensureLoaded(): void {
    if (this.loaded) {
      return;
    }

    this.loaded = true;

    this.http
      .get<GeneralResponseOf<StorefrontFeatures>>(
        `${this.baseUrl}features`,

        // The error handling below is not enough on its own. Without this the
        // interceptor owns the failure first: a 404 from here — an API too old
        // to have the endpoint, say — navigates the whole application to
        // /not-found, and under server rendering that turns every page in the
        // shop into a 404 answered to Google. The header asking a question
        // must never be able to decide what page the reader is on.
        { context: handledInline() })
      .pipe(map(response => response.data))
      .subscribe({
        next: features => {
          if (features) {
            this.state.set(features);
          }
        },

        // An unreachable API is not a reason to redraw the header. The pages
        // themselves will say what is wrong, in their own words.
        error: () => undefined
      });
  }
}
