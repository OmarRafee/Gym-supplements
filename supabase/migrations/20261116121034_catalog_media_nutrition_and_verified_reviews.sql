alter table public.products
  add column if not exists image_urls text[] not null default '{}'::text[],
  add column if not exists nutrition_facts jsonb not null default '{}'::jsonb,
  add column if not exists allergen_info text,
  add column if not exists certifications text[] not null default '{}'::text[];

update public.products
set image_urls = array[image_url]
where image_url is not null and cardinality(image_urls) = 0;

alter table public.products
  add constraint products_nutrition_facts_object
  check (jsonb_typeof(nutrition_facts) = 'object');

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text not null check (char_length(trim(title)) between 3 and 120),
  body text not null check (char_length(trim(body)) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_reviews_public_product_idx
  on public.product_reviews (product_id, created_at desc)
  where status = 'approved';
create index if not exists product_reviews_admin_queue_idx
  on public.product_reviews (status, created_at desc);

alter table public.product_reviews enable row level security;
grant select on public.product_reviews to anon, authenticated;
grant insert, update on public.product_reviews to authenticated;

create policy "Public read approved product reviews"
  on public.product_reviews for select
  to anon
  using (status = 'approved');

create policy "Customers and admins read product reviews"
  on public.product_reviews for select
  to authenticated
  using (status = 'approved' or (select public.is_admin()));

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
        and oi.product_id = product_id
        and o.user_id = (select auth.uid())
        and o.status = 'delivered'
    )
  );

create policy "Admins moderate product reviews"
  on public.product_reviews for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create trigger product_reviews_touch_updated_at
  before update on public.product_reviews
  for each row execute function public.touch_updated_at();

comment on column public.products.image_urls is 'Product gallery image URLs; image_url remains as the first-image compatibility field.';
comment on column public.products.nutrition_facts is 'Structured nutrition label values entered by store admins.';
comment on table public.product_reviews is 'Verified-purchase customer reviews; public reads require admin approval.';
