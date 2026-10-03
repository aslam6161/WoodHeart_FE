import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-admin-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="px-4 py-3">
      <span class="small text-muted">WoodHeart Admin © {{ year }}</span>
    </footer>
  `
})
export class AdminFooter {
  protected readonly year = new Date().getFullYear();
}
