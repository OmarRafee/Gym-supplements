drop policy if exists "Verified customers submit product reviews" on public.product_reviews;
create policy "Verified customers submit product reviews"
  on public.product_reviews for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id
        and oi.product_id = product_reviews.product_id
        and o.user_id = (select auth.uid())
        and o.status = 'delivered'
    )
  );
