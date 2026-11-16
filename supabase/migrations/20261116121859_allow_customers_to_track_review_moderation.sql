drop policy if exists "Customers and admins read product reviews" on public.product_reviews;
create policy "Customers and admins read product reviews"
  on public.product_reviews for select
  to authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or (select public.is_admin()));
