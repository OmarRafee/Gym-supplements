export type CartLine = { price: number; quantity: number };
export type ShippingSettings = { standard_fee?: number; free_shipping_threshold?: number };
export function calculateCartSummary(items: CartLine[], shippingSettings?: ShippingSettings, discount?: number): { subtotal: number; shipping: number; discount: number; total: number };
export function normalizeCouponPreview(preview: { valid?: boolean; discount_amount?: number; message?: string } | null | undefined, subtotal: number): { valid: boolean; discount: number; message: string };
