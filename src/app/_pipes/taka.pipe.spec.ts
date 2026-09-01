import { TakaPipe } from './taka.pipe';

describe('TakaPipe', () => {
  const pipe = new TakaPipe();

  it('formats a whole amount with the taka sign and no decimals', () => {
    expect(pipe.transform(68500)).toBe('৳68,500');
  });

  it('keeps two decimals when the amount has them', () => {
    // A delivery surcharge can be 250.50. Rounding it away in the display
    // means the figure on the page and the figure on the invoice disagree.
    expect(pipe.transform(250.5)).toBe('৳250.50');
  });

  it('renders zero rather than an empty string', () => {
    // Free delivery is a price, and "৳0" is the thing to show. A falsy check
    // here would blank it.
    expect(pipe.transform(0)).toBe('৳0');
  });

  it('renders nothing for a missing amount', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(Number.NaN)).toBe('');
  });
});
