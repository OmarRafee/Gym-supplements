import test from "node:test";
import assert from "node:assert/strict";
import { calculateCartSummary, normalizeCouponPreview } from "../src/lib/store-math.mjs";

test("cart subtotal, delivery and total are calculated in EGP", () => {
  assert.deepEqual(calculateCartSummary([{price: 250, quantity: 2},{price: 100,quantity:1}], {standard_fee:60,free_shipping_threshold:1500}), {subtotal:600,shipping:60,discount:0,total:660});
});
test("free delivery threshold is applied at the threshold", () => {
  assert.equal(calculateCartSummary([{price:750,quantity:2}], {standard_fee:60,free_shipping_threshold:1500}).shipping, 0);
});
test("discount is clamped to subtotal and never creates a negative total", () => {
  assert.deepEqual(calculateCartSummary([{price:100,quantity:1}], {standard_fee:60,free_shipping_threshold:1500}, 999), {subtotal:100,shipping:60,discount:100,total:60});
});
test("zero, negative and fractional cart quantities are rejected", () => {
  for (const quantity of [0,-1,1.5]) assert.throws(() => calculateCartSummary([{price:100,quantity}]), TypeError);
});
test("valid coupon preview is normalized", () => {
  assert.deepEqual(normalizeCouponPreview({valid:true,discount_amount:50,message:"Saved 50"},300), {valid:true,discount:50,message:"Saved 50"});
});
test("expired or below-minimum coupon preview is not applied", () => {
  for (const message of ["This discount has expired.","Add 100 more to use this code."]) {
    assert.deepEqual(normalizeCouponPreview({valid:false,discount_amount:0,message},300), {valid:false,discount:0,message});
  }
});
test("malformed and excessive coupon discounts are safe", () => {
  assert.equal(normalizeCouponPreview({valid:true,discount_amount:500},200).discount,200);
  assert.equal(normalizeCouponPreview({valid:true,discount_amount:-2},200).valid,false);
});

test("empty cart has a zero subtotal and standard delivery fee", () => {
  assert.deepEqual(calculateCartSummary([], {standard_fee:60,free_shipping_threshold:1500}), {subtotal:0,shipping:60,discount:0,total:60});
});
test("free delivery applies above the configured threshold", () => {
  assert.equal(calculateCartSummary([{price:800,quantity:2}], {standard_fee:75,free_shipping_threshold:1500}).shipping, 0);
});
test("invalid shipping settings fall back to safe non-negative delivery", () => {
  assert.equal(calculateCartSummary([{price:100,quantity:1}], {standard_fee:-50,free_shipping_threshold:1500}).shipping, 0);
});
test("invalid prices are rejected", () => {
  for (const price of [NaN, Infinity, -1, "not-a-price"]) assert.throws(() => calculateCartSummary([{price,quantity:1}]), TypeError);
});
test("coupon previews reject missing and non-numeric discounts", () => {
  assert.equal(normalizeCouponPreview(null,200).valid,false);
  assert.equal(normalizeCouponPreview({valid:true,discount_amount:"oops"},200).valid,false);
});
test("coupon discount cannot exceed a zero basket", () => {
  assert.deepEqual(normalizeCouponPreview({valid:true,discount_amount:30},0), {valid:true,discount:0,message:"Discount applied."});
});
