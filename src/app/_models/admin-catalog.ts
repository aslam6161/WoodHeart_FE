import { MediaType, ProductType } from './catalog';

/**
 * The admin half of the catalog contract.
 *
 * <b>Kept apart from `catalog.ts` on purpose.</b> Those are the storefront
 * shapes; these carry `status`, the internal product code, and — the day
 * someone adds it for a margin report — a supplier cost price. The backend
 * keeps the two DTO families separate so an admin-only field cannot reach a
 * customer by inheritance, and mirroring that split here keeps the guarantee
 * honest on the client too.
 */

/** Mirrors `ProductStatus`. Sent and received by name, never by number. */
export type ProductStatus = 'Draft' | 'Active' | 'Archived';

/** Mirrors `ProductSort` on the backend. */
export type ProductSort =
  | 'Newest'
  | 'Oldest'
  | 'PriceLowToHigh'
  | 'PriceHighToLow'
  | 'RecentlyPublished'
  | 'Code';

export interface AdminProductListItem {
  id: number;
  code: string;
  nameEn: string;
  nameBn?: string | null;
  slug: string;
  categoryId: number;
  categoryNameEn: string;
  brandId?: number | null;
  brandNameEn?: string | null;
  productType: ProductType;
  status: ProductStatus;
  basePrice: number;
  compareAtPrice?: number | null;
  currency: string;
  isFeatured: boolean;
  publishedAt?: string | null;
  variantCount: number;

  /** Storage key of the primary image, or null. Not a URL — see MediaUrlService. */
  primaryImagePath?: string | null;
}

export interface AdminProductDetail extends AdminProductListItem {
  shortDescriptionEn?: string | null;
  shortDescriptionBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  material?: string | null;
  finishType?: string | null;
  warrantyMonths?: number | null;
  leadTimeDays?: number | null;
  assemblyRequired: boolean;
  deliverySurcharge?: number | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  ogImagePath?: string | null;
  averageRating?: number | null;
  reviewCount: number;
  variants: AdminProductVariant[];
  media: AdminProductMedia[];
}

export interface AdminProductVariant {
  id: number;
  productId: number;
  sku: string;
  variantName: string;
  optionValues: Record<string, string>;

  /** The variant's override, or the product's base price. Resolved server-side. */
  effectivePrice: number;

  effectiveCompareAtPrice?: number | null;
  isOnOffer: boolean;
  barcode?: string | null;
  weightKg?: number | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface AdminProductMedia {
  id: number;
  variantId?: number | null;
  mediaType: MediaType;

  /** The Cloudinary public id. A key, not a URL. */
  storagePath: string;

  altText?: string | null;
  caption?: string | null;
  isPrimary: boolean;
  sortOrder: number;
  width?: number | null;
  height?: number | null;
  externalUrl?: string | null;
}

// -----------------------------------------------------------------------------
// Writes
// -----------------------------------------------------------------------------

export interface CreateProductDto {
  code: string;
  nameEn: string;
  nameBn?: string | null;

  /** Leave empty to derive from the name. */
  slug?: string | null;

  categoryId: number;
  brandId?: number | null;
  productType: ProductType;
  basePrice: number;
  compareAtPrice?: number | null;
  shortDescriptionEn?: string | null;
  shortDescriptionBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  material?: string | null;
  finishType?: string | null;
  warrantyMonths?: number | null;
  leadTimeDays?: number | null;
  assemblyRequired: boolean;
  deliverySurcharge?: number | null;
  isFeatured: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;

  /**
   * Optional. An empty list makes the service create one default variant
   * carrying the product's own price, which is how "every product has at least
   * one variant" holds without the form inventing a variant for a product that
   * has no options.
   */
  variants?: CreateProductVariantDto[];
}

/**
 * An edit. Deliberately carries no variants — those have their own endpoints.
 *
 * Accepting a variant list would mean deciding what an omitted variant means,
 * and every plausible answer is dangerous: silently deleting one destroys its
 * stock ledger and its order-history links.
 */
export type UpdateProductDto = Omit<CreateProductDto, 'variants'>;

export interface CreateProductVariantDto {
  sku: string;

  /** Leave empty to build it from the options. */
  variantName?: string | null;

  optionValues: Record<string, string>;

  /** Null inherits the product's base price. */
  priceOverride?: number | null;

  compareAtPriceOverride?: number | null;
  barcode?: string | null;
  weightKg?: number | null;
  isDefault: boolean;
  isActive: boolean;
}

export type UpdateProductVariantDto = CreateProductVariantDto;

export interface AdminProductQuery {
  pageNumber?: number;
  pageSize?: number;
  categoryId?: number | null;
  includeDescendantCategories?: boolean;
  brandId?: number | null;
  productType?: ProductType | null;

  /**
   * Absent means every status.
   *
   * The storefront has no equivalent — the backend overwrites it to `Active`
   * on every public request, so a draft is unreachable there no matter what
   * the client asks for. Here it is a real control.
   */
  status?: ProductStatus | null;

  isFeatured?: boolean | null;
  search?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  sortBy?: ProductSort;
}

// --- Categories --------------------------------------------------------------

export interface AdminCategory {
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
  productCount: number;
}

export interface AdminCategoryTree extends AdminCategory {
  children: AdminCategoryTree[];
}

export interface CreateCategoryDto {
  nameEn: string;
  nameBn?: string | null;
  slug?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  parentId?: number | null;
  isActive: boolean;
  isFeatured: boolean;
  imagePath?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
}

/**
 * An edit, without `parentId`.
 *
 * Moving a category rewrites the materialized path of every descendant and has
 * to be checked for cycles. Folding that into a rename would make every edit
 * pay the cost and let any caller trigger it by accident — it goes through
 * {@link MoveCategoryDto} instead.
 */
export type UpdateCategoryDto = Omit<CreateCategoryDto, 'parentId'>;

export interface MoveCategoryDto {
  /** Null moves it to the root. */
  newParentId?: number | null;

  /** Null appends it after the existing children. */
  sortOrder?: number | null;
}

// --- Brands ------------------------------------------------------------------

export interface AdminBrand {
  id: number;
  nameEn: string;
  nameBn?: string | null;
  slug: string;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  logoPath?: string | null;
  isActive: boolean;
  sortOrder: number;
  productCount: number;
}

export interface CreateBrandDto {
  nameEn: string;
  nameBn?: string | null;
  slug?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  logoPath?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export type UpdateBrandDto = CreateBrandDto;

// --- Media -------------------------------------------------------------------

export interface UpdateProductMediaDto {
  /**
   * Required, and the backend enforces it.
   *
   * Alt text is the classic field that is optional in the form and therefore
   * empty on every row — and an empty one is a silent accessibility and SEO
   * failure on the page that sells the product.
   */
  altText: string;

  caption?: string | null;
}

export interface ReorderProductMediaDto {
  /** Every id, in the order they should appear. */
  mediaIds: number[];
}

/** What the browser needs to upload one video straight to Cloudinary. */
export interface VideoUploadTicket {
  uploadUrl: string;

  /** The public half of the credential pair. The secret never leaves the server. */
  apiKey: string;

  timestamp: number;
  signature: string;
  publicId: string;
  folder: string;
}

export interface ConfirmVideoUploadDto {
  publicId: string;
  variantId?: number | null;
  altText?: string | null;
  caption?: string | null;
}
