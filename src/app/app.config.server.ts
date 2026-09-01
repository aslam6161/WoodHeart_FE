import { mergeApplicationConfig, ApplicationConfig, REQUEST, inject } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import { API_ORIGIN, SITE_ORIGIN } from './_interceptors/api-base.interceptor';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),

    {
      // The origin the SSR process uses to reach the API.
      //
      // In production `environment.apiUrl` is `/api/` — right for the browser,
      // where nginx proxies the API on the same origin, and unusable on the
      // server, where Node's fetch rejects a relative URL outright. See
      // `apiBaseInterceptor` for why that would have failed only in production.
      //
      // `API_INTERNAL_URL` wins when it is set: inside Docker the SSR container
      // can reach the API container directly and skip the hop back out through
      // the proxy. Otherwise the incoming request's own origin is used, which
      // is correct whenever the app and the API share a host.
      provide: API_ORIGIN,
      useFactory: () => {
        const configured = process.env['API_INTERNAL_URL'];

        if (configured) {
          return configured;
        }

        const request = inject(REQUEST, { optional: true });

        // Null during prerendering and route extraction, where there is no
        // request. The interceptor then leaves the URL alone and the fetch
        // fails honestly, rather than being pointed somewhere invented — a
        // guess here would bake one environment's host into another's build.
        return request ? new URL(request.url).origin : null;
      }
    },

    {
      // The origin the storefront is served from, for canonical and og:url.
      //
      // `SITE_URL` wins so a deployment can state its canonical host outright —
      // behind a proxy the request's own origin is the internal one, and a
      // canonical pointing at `http://web:4000` is worse than none. Without it
      // the request origin is right for the ordinary single-host case.
      provide: SITE_ORIGIN,
      useFactory: () => {
        const configured = process.env['SITE_URL'];

        if (configured) {
          return configured;
        }

        const request = inject(REQUEST, { optional: true });

        return request ? new URL(request.url).origin : null;
      }
    }
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
