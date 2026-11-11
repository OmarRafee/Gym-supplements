export function calculateCartSummary(items, shippingSettings = {}, discount = 0) {
  const subtotal = items.reduce((sum, item) => {
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) {
      throw new TypeError("Cart items must have a non-negative price and a positive integer quantity.");
    }
    return sum + price * quantity;
  }, 0);
  const threshold = Number(shippingSettings.free_shipping_threshold ?? 1500);
  const standardFee = Number(shippingSettings.standard_fee ?? 60);
  const shipping = subtotal >= threshold ? 0 : Math.max(0, Number.isFinite(standardFee) ? standardFee : 0);
  const safeDiscount = Math.min(subtotal, Math.max(0, Number.isFinite(Number(discount)) ? Number(discount) : 0));
  return { subtotal, shipping, discount: safeDiscount, total: Math.max(0, subtotal + shipping - safeDiscount) };
}

export function normalizeCouponPreview(preview, subtotal) {
  if (!preview || preview.valid !== true) {
    return { valid: false, discount: 0, message: preview?.message || "This code is not available." };
  }
  const basket = Math.max(0, Number(subtotal) || 0);
  const proposed = Number(preview.discount_amount);
  if (!Number.isFinite(proposed) || proposed < 0) {
    return { valid: false, discount: 0, message: "The discount response was invalid. Please try again." };
  }
  const discount = Math.min(basket, proposed);
  return { valid: true, discount, message: preview.message || "Discount applied." };
}
