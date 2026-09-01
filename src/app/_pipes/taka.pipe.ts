import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats an amount as taka: `৳68,500`.
 *
 * <b>A pipe rather than Angular's `CurrencyPipe`.</b> `currency: 'BDT'` renders
 * "BDT 68,500.00" unless the `bn-BD` locale data is registered and the symbol
 * is asked for explicitly, and the `.00` is noise on a catalogue where every
 * price is whole taka. Registering locale data to get one symbol costs more
 * than this.
 *
 * Grouping is fixed to `en-US` rather than left to the runtime's default.
 * `Intl` on the SSR Node process and `Intl` in the customer's browser must
 * produce byte-identical output — a different grouping on one side is a
 * hydration mismatch on every price on the page.
 */
@Pipe({ name: 'taka' })
export class TakaPipe implements PipeTransform {
  private static readonly whole = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  private static readonly fractional = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  transform(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '';
    }

    const formatter = Number.isInteger(value) ? TakaPipe.whole : TakaPipe.fractional;

    return `৳${formatter.format(value)}`;
  }
}
