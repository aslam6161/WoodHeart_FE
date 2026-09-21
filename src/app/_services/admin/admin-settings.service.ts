import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { GeneralResponseOf } from '../../_models/generalResponse';
import { StoreSetting, UpdateSettings } from '../../_models/settings';

/** The store settings table, for the admin screen. Admin-only on the API. */
@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}admin/settings`;

  getAll(): Observable<StoreSetting[]> {
    return this.http
      .get<GeneralResponseOf<StoreSetting[]>>(this.baseUrl)
      .pipe(map(response => response.data ?? []));
  }

  /**
   * Saves every value sent — all or none. A refusal comes back as a 400 with
   * `errors` keyed by setting key, which the screen puts beside each field.
   */
  update(dto: UpdateSettings): Observable<GeneralResponseOf<StoreSetting[]>> {
    return this.http.put<GeneralResponseOf<StoreSetting[]>>(this.baseUrl, dto);
  }
}
