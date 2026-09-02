import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

import { routes } from './app.routes';
import { jwtInterceptor } from './_interceptors/jwt.interceptor';
import { errorInterceptor } from './_interceptors/error.interceptor';
import { loadingInterceptor } from './_interceptors/loading.interceptor';
import { apiBaseInterceptor } from './_interceptors/api-base.interceptor';
import { AccountService } from './_services/account.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),

    provideRouter(
      routes,
      // Route params bind straight to component inputs, so a product detail
      // page takes `slug` as an input rather than reading ActivatedRoute.
      withComponentInputBinding(),
      // Without this, navigating from halfway down a category listing into a
      // product lands you halfway down the product page.
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' })
    ),

    provideHttpClient(
      // fetch rather than XHR: required for SSR to stream properly.
      withFetch(),
      // Order matters. Outermost first: apiBase resolves the URL so every
      // interceptor after it sees the address the request will actually go to,
      // then loading wraps the exchange so the spinner covers all of it, then
      // jwt attaches credentials, then error sits closest to the response so it
      // sees failures first.
      withInterceptors([apiBaseInterceptor, loadingInterceptor, jwtInterceptor, errorInterceptor])
    ),

    provideClientHydration(withEventReplay()),

    /**
     * Starts the session restore as early as possible, and deliberately does
     * not wait for it.
     *
     * The access token lives in memory, so every page load starts signed out
     * and asks the refresh cookie for a new one. Returning the promise here
     * would block bootstrap on that round trip for every visitor — including
     * the great majority who have never signed in and will get a 401. So it is
     * kicked off here and awaited only where it matters: the guards, which
     * share this same memoised call.
     */
    provideAppInitializer(() => {
      void inject(AccountService).ensureRestored();
    })
  ]
};
