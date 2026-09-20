/**
 * Runtime settings, mirroring `SettingsDtos.cs` on the backend.
 *
 * Values are strings whatever their type; the API parses them against the
 * declared `valueType` and stores the normalised spelling. The screen renders
 * the control from the type and sends back a string.
 */
export type SettingValueType = 'String' | 'Integer' | 'Decimal' | 'Boolean' | 'Json';

export interface StoreSetting {
  key: string;
  value: string;
  valueType: SettingValueType;
  /** Store, Tax, Delivery, Orders, Inventory — the screen's sections, in the API's order. */
  category: string;
  description?: string | null;
  updatedAt?: string | null;
}

/** What the screen sends: only the keys it holds, every value as a string. */
export interface UpdateSettings {
  values: Record<string, string>;
}

/**
 * How each setting is labelled. The key is what the code reads; this is what
 * the owner sees. A key without an entry is shown by its key, so a setting
 * the backend adds before this map catches up is still editable.
 */
export const SETTING_LABELS: Record<string, string> = {
  'store.name': 'Shop name',
  'store.address': 'Address',
  'store.phone': 'Phone',
  'store.email': 'Email',
  'store.bin': 'BIN (VAT registration number)',
  'tax.vat_rate': 'VAT rate (%)',
  'tax.prices_include_vat': 'Prices shown include VAT',
  'tax.vat_on_delivery': 'VAT applies to the delivery charge',
  'delivery.charge_inside_dhaka': 'Default delivery charge inside Dhaka (৳)',
  'delivery.charge_outside_dhaka': 'Default delivery charge outside Dhaka (৳)',
  'delivery.free_threshold': 'Free delivery on orders from (৳)',
  'orders.number_prefix': 'Order number prefix',
  'inventory.low_stock_threshold': 'Low-stock threshold (units)'
};

/** Settings that want a bigger box than one line. */
export const MULTILINE_SETTINGS: ReadonlySet<string> = new Set(['store.address']);
