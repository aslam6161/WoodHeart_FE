import { StorefrontProduct } from './catalog';

/** One thing already said, in the order it was said. */
export interface ShopChatTurn {
  fromCustomer: boolean;
  text: string;
}

/**
 * The kinds of button the assistant may offer.
 *
 * A closed list, matching the server's. The API drops anything not on it before
 * it reaches here, and this type is the second half of that promise: a `kind`
 * the storefront cannot carry out will not compile into a handler.
 */
export type ShopChatActionKind =
  | 'view_product'
  | 'add_to_basket'
  | 'view_basket'
  | 'checkout'
  | 'track_order'
  | 'book_consultation';

/**
 * Something the customer may want to do next.
 *
 * <b>The assistant proposes; the storefront acts.</b> Pressing one of these
 * runs the same cart and router code every other button on the site runs. The
 * model never touches a basket.
 */
export interface ShopChatAction {
  kind: ShopChatActionKind;
  label: string;
  slug?: string | null;
}

/** An answer: words, real products, and what to offer next. */
export interface ShopChatReply {
  reply: string;

  /** Read from the database after the model answered — never described by it. */
  products: StorefrontProduct[];

  actions: ShopChatAction[];
}

/** One message as the window shows it. */
export interface ShopChatMessage {
  fromCustomer: boolean;
  text: string;
  products?: StorefrontProduct[];
  actions?: ShopChatAction[];
}
