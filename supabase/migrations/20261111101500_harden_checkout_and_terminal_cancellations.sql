-- Harden the checkout boundary and make cancelled orders terminal.
-- This migration is intentionally additive and does not delete or rewrite store data.

create or replace function public.place_order(
 p_items jsonb,
 p_full_name text,
 p_phone text,
 p_address text,
 p_city text,
 p_payment_method text default 'cod',
 p_notes text default null,
 p_coupon_code text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
 v_user_id uuid := (select auth.uid());
 v_order_id uuid;
 v_subtotal numeric(10,2):=0;
 v_shipping numeric(10,2):=0;
 v_discount numeric(10,2):=0;
 v_total numeric(10,2):=0;
 v_item record;
 v_product record;
 v_coupon public.coupons%rowtype;
 v_payment_status text;
 v_shipping_settings jsonb;
 v_payment_settings jsonb;
begin
 if v_user_id is null then raise exception 'Please sign in before placing your order.'; end if;
 if p_payment_method <> 'cod' then raise exception 'Cash on delivery is the only active payment method. InstaPay and Visa will be added later.'; end if;
 if coalesce(length(trim(p_full_name)),0)<2 or coalesce(length(trim(p_phone)),0)<7
   or coalesce(length(trim(p_address)),0)<5 or coalesce(length(trim(p_city)),0)<2
 then raise exception 'Please provide valid delivery details.'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>30
 then raise exception 'Your cart is empty or contains too many items.'; end if;

 -- Validate each submitted row before aggregation. Otherwise a positive and
 -- negative duplicate line could cancel each other out during SUM(quantity).
 if exists (
   select 1
   from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
   where x.product_id is null or x.quantity is null or x.quantity < 1 or x.quantity > 50
 ) then
   raise exception 'Every cart line must have a product and a quantity from 1 to 50.';
 end if;

 v_payment_status:='pending';
 insert into public.orders(user_id,status,payment_method,payment_status,total,subtotal,shipping_fee,full_name,phone,address,city,notes)
 values(v_user_id,'pending',p_payment_method,v_payment_status,0,0,0,trim(p_full_name),trim(p_phone),trim(p_address),trim(p_city),nullif(trim(coalesce(p_notes,'')),''))
 returning id into v_order_id;
 perform set_config('app.current_order_id',v_order_id::text,true);
 for v_item in
   select x.product_id,sum(x.quantity)::integer as quantity
   from jsonb_to_recordset(p_items) as x(product_id uuid,quantity integer)
   group by x.product_id order by x.product_id
 loop
   if v_item.product_id is null or v_item.quantity is null or v_item.quantity<1 or v_item.quantity>50
   then raise exception 'Invalid product or quantity in cart.'; end if;
   select id,name,sku,price,stock,is_active into v_product
   from public.products where id=v_item.product_id and is_visible=true for update;
   if not found or not v_product.is_active then raise exception 'One of the selected products is unavailable.'; end if;
   if v_product.stock<v_item.quantity then raise exception 'Insufficient stock for %.',v_product.name; end if;
   update public.products set stock=stock-v_item.quantity where id=v_item.product_id;
   insert into public.order_items(order_id,product_id,quantity,unit_price,product_name,product_sku,line_total)
   values(v_order_id,v_item.product_id,v_item.quantity,v_product.price,v_product.name,v_product.sku,v_product.price*v_item.quantity);
   v_subtotal:=v_subtotal+(v_product.price*v_item.quantity);
 end loop;
 select setting_value into v_shipping_settings from public.store_settings where setting_key='shipping';
 v_shipping:=coalesce((v_shipping_settings->>'standard_fee')::numeric,0);
 if v_subtotal>=coalesce((v_shipping_settings->>'free_shipping_threshold')::numeric,999999999) then v_shipping:=0; end if;
 if nullif(trim(coalesce(p_coupon_code,'')),'') is not null then
   select * into v_coupon from public.coupons where upper(code)=upper(trim(p_coupon_code)) and is_active=true for update;
   if not found then raise exception 'Discount code is not recognised.'; end if;
   if v_coupon.starts_at is not null and now()<v_coupon.starts_at then raise exception 'This discount has not started yet.'; end if;
   if v_coupon.ends_at is not null and now()>v_coupon.ends_at then raise exception 'This discount has expired.'; end if;
   if v_coupon.usage_limit is not null and v_coupon.used_count>=v_coupon.usage_limit then raise exception 'This discount has reached its usage limit.'; end if;
   if v_subtotal<v_coupon.minimum_order then raise exception 'Your order does not meet this discount minimum.'; end if;
   v_discount:=case when v_coupon.discount_type='percentage' then v_subtotal*v_coupon.discount_value/100 else v_coupon.discount_value end;
   if v_coupon.maximum_discount is not null then v_discount:=least(v_discount,v_coupon.maximum_discount); end if;
   v_discount:=least(v_subtotal,greatest(0,round(v_discount,2)));
   update public.coupons set used_count=used_count+1 where id=v_coupon.id;
 end if;
 v_total:=greatest(0,v_subtotal+v_shipping-v_discount);
 update public.orders set subtotal=v_subtotal,shipping_fee=v_shipping,discount_total=v_discount,total=v_total,
   coupon_id=v_coupon.id,coupon_code=v_coupon.code,updated_at=now()
 where id=v_order_id;
 perform set_config('app.current_order_id','',true);
 return v_order_id;
exception when others then
 perform set_config('app.current_order_id','',true);
 raise;
end;
$function$;

create or replace function public.prevent_cancelled_order_reopen()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.status = 'cancelled' and new.status is distinct from 'cancelled' then
    raise exception 'Cancelled orders are terminal and cannot be reopened.';
  end if;
  return new;
end;
$function$;

drop trigger if exists orders_prevent_cancelled_reopen on public.orders;
create trigger orders_prevent_cancelled_reopen
before update of status on public.orders
for each row execute function public.prevent_cancelled_order_reopen();

-- These RPCs are authenticated endpoints. Admin RPCs perform their own
-- is_admin() authorization check; checkout and coupon preview require a user.
revoke all on function public.place_order(jsonb,text,text,text,text,text,text,text) from public, anon;
grant execute on function public.place_order(jsonb,text,text,text,text,text,text,text) to authenticated;
revoke all on function public.preview_coupon(text,numeric) from public, anon;
grant execute on function public.preview_coupon(text,numeric) to authenticated;
revoke all on function public.admin_set_order_status(uuid,text) from public, anon;
grant execute on function public.admin_set_order_status(uuid,text) to authenticated;
revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
-- Public store settings are intentionally readable by anonymous visitors.
revoke all on function public.get_public_store_settings() from public;
grant execute on function public.get_public_store_settings() to anon, authenticated;
