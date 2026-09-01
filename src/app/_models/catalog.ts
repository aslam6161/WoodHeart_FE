/**
 * The catalog shapes, mirroring the storefront DTOs on the backend.
 *
 * Only the *storefront* DTOs are mirrored here. The admin product DTO carries
 * `status`, the internal product code and — the day someone adds it for a
 * margin report — a supplier cost price. The backend keeps the two apart on
 * purpose; mirroring only this half keeps that separation honest on the client
 * too, so a future admin field cannot arrive in a customer's bundle by
 * inheritance.
 */

/**
 * String unions, not TypeScript enums.
 *
 * The API serialises enums as names (`JsonStringEnumConverter`), so `'Stocked'`
 * is literally what arrives. A numeric TS enum would silently compare `0` to
 * `"Stocked"` and be false everywhere.
 */
export type ProductType = 'Stocked' | 'MadeToOrder' | 'Service';

export type MediaType = 'Image' | 'Video' | 'Document';

/**
 * Mirrors `ProductSort` on the backend.
 *
 * Sent by name for the same reason: the API binds the enum name. There is
 * deliberately no sort by name — the product name is a jsonb column, and
 * ordering by it arrives with the tsvector search work.
 */
export type ProductSort =
  | 'Newest'
  | 'Oldest'
  | 'PriceLowToHigh'
  | 'PriceHighToLow'
  | 'RecentlyPublished'
  | 'Code';

export interface CategoryTree {
  id: number;
  nameEn: string;
  nameBn?: string | null;
  slug: string;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  parentId?: number | null;
  depth: number;
  sortOrder: number;
  isActive: boolean;
  isFeatured: boolean;
  imagePath?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  /** Live products in this category. Does not include descendants. */
  productCount: number;
  children: CategoryTree[];
}

/** A product card. */
export interface StorefrontProduct {
  id: number;
  slug: string;
  nameEn: string;
  nameBn?: string | null;
  shortDescriptionEn?: string | null;
  shortDescriptionBn?: string | null;
  categorySlug: string;
  categoryNameEn: string;
  brandNameEn?: string | null;
  productType: ProductType;

  /**
   * The lowest effective price across the product's active variants — the
   * cheapest thing a customer can actually buy, not the nominal base price.
   * Rendered as "from ৳45,000" when there is more than one variant.
   */
  fromPrice: number;

  compareAtPrice?: number | null;
  currency: string;
  isOnOffer: boolean;
  /** Whole percent, for the badge. Null when there is no offer. */
  discountPercent?: number | null;
  isFeatured: boolean;
  /** Working days to build. Null for stocked products. */
  leadTimeDays?: number | null;
  averageRating?: number | null;
  reviewCount: number;
  primaryImagePath?: string | null;
  primaryImageAlt?: string | null;
  variantCount: number;
}

export interface StorefrontProductDetail extends StorefrontProduct {
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  material?: string | null;
  finishType?: string | null;
  warrantyMonths?: number | null;
  assemblyRequired: boolean;
  deliverySurcharge?: number | null;
  breadcrumbs: StorefrontBreadcrumb[];
  seo: StorefrontSeo;
  variants: StorefrontVariant[];
  media: StorefrontMedia[];
}

export interface StorefrontVariant {
  id: number;
  sku: string;
  variantName: string;
  /** e.g. `{ Size: '6ft', Wood: 'Segun' }`. Drives the option pickers. */
  optionValues: Record<string, string>;
  price: number;
  compareAtPrice?: number | null;
  isOnOffer: boolean;
  isDefault: boolean;
}

export interface StorefrontMedia {
  id: number;
  /** Null means the image belongs to the product rather than one variant. */
  variantId?: number | null;
  mediaType: MediaType;
  storagePath: string;
  altText?: string | null;
  caption?: string | null;
  isPrimary: boolean;
  /**
   * Intrinsic dimensions. Set them on the `<img>` so the browser reserves the
   * space before the image loads — omitting them is a Cumulative Layout Shift
   * penalty on exactly the pages that need to rank.
   */
  width?: number | null;
  height?: number | null;
  externalUrl?: string | null;
}

export interface StorefrontBreadcrumb {
  nameEn: string;
  nameBn?: string | null;
  slug: string;
}

export interface StorefrontSeo {
  title: string;
  description?: string | null;
  /** Path only, e.g. `/products/segun-king-bed`. The host is the client's business. */
  canonicalPath: string;
  ogImagePath?: string | null;
}

export interface StorefrontCollection {
  id: number;
  slug: string;
  nameEn: string;
  nameBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  bannerPath?: string | null;
  thumbnailPath?: string | null;
  seo: StorefrontSeo;
}

/**
 * The listing filters, mirroring `ProductQuery`.
 *
 * `status` is deliberately absent. The backend overwrites it to `Active` for
 * every storefront request, so a field here would be a control that does
 * nothing — and would read like a way to see drafts.
 */
export interface ProductQuery {
  pageNumber?: number;
  pageSize?: number;
  categoryId?: number | null;
  includeDescendantCategories?: boolean;
  brandId?: number | null;
  productType?: ProductType | null;
  isFeatured?: boolean | null;
  search?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  sortBy?: ProductSort;
}
