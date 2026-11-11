-- Transactional checkout regression tests.
-- Run only against a disposable Supabase branch or as a transaction and ROLLBACK.
-- All fixtures use QA-prefixed identifiers and are rolled back by the harness.
begin;

do $qa$
declare
  v_user uuid := gen_random_uuid();
  v_admin uuid;
  v_product uuid := gen_random_uuid();
  v_hidden uuid := gen_random_uuid();
  v_last_unit uuid := gen_random_uuid();
  v_order uuid;
  v_second_order uuid;
  v_valid_coupon text := 'QA-VALID-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  v_expired_coupon text := 'QA-EXPIRED-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  v_min_coupon text := 'QA-MIN-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  v_limit_coupon text := 'QA-LIMIT-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  v_valid boolean;
  v_discount numeric;
  v_subtotal numeric;
  v_stock integer;
  v_rejected boolean;
  v_count integer;
begin
  select user_id into v_admin from public.admins order by created_at limit 1;
  if v_admin is null then raise exception 'QA setup failed: no admin account exists'; end if;

  insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_user,'authenticated','authenticated','qa+'||replace(v_user::text,'-','')||'@example.invalid',
    crypt('QA-only-password-123!',gen_salt('bf')),now(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"QA Checkout User"}'::jsonb,now(),now());

  insert into public.products(id,name,slug,category,description,price,stock,is_active,is_visible,reorder_level)
  values(v_product,'QA Checkout Product','qa-checkout-'||substr(v_product::text,1,8),'QA','Temporary QA fixture',100,2,true,true,1);
  insert into public.products(id,name,slug,category,description,price,stock,is_active,is_visible,reorder_level)
  values(v_hidden,'QA Hidden Product','qa-hidden-'||substr(v_hidden::text,1,8),'QA','Temporary hidden fixture',200,2,true,false,1);
  insert into public.products(id,name,slug,category,description,price,stock,is_active,is_visible,reorder_level)
  values(v_last_unit,'QA Last Unit','qa-last-'||substr(v_last_unit::text,1,8),'QA','Temporary concurrency fixture',75,1,true,true,1);

  insert into public.coupons(code,discount_type,discount_value,minimum_order,usage_limit,used_count,is_active)
  values(v_valid_coupon,'percentage',10,0,2,0,true);
  insert into public.coupons(code,discount_type,discount_value,minimum_order,usage_limit,used_count,ends_at,is_active)
  values(v_expired_coupon,'percentage',10,0,10,0,now()-interval '1 day',true);
  insert into public.coupons(code,discount_type,discount_value,minimum_order,usage_limit,used_count,is_active)
  values(v_min_coupon,'fixed',25,500,10,0,true);
  insert into public.coupons(code,discount_type,discount_value,minimum_order,usage_limit,used_count,is_active)
  values(v_limit_coupon,'fixed',25,0,1,1,true);

  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  -- Tampered client price is ignored; server product price is snapshotted.
  v_order := public.place_order(
    jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1,'price',0,'unit_price',0)),
    'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,null
  );
  select subtotal into v_subtotal from public.orders where id=v_order;
  if v_subtotal <> 100 then raise exception 'FAIL: server ignored product price was not used; subtotal=%',v_subtotal; end if;
  select unit_price into v_discount from public.order_items where order_id=v_order;
  if v_discount <> 100 then raise exception 'FAIL: order item unit price was not sourced from products'; end if;
  select stock into v_stock from public.products where id=v_product;
  if v_stock <> 1 then raise exception 'FAIL: stock was not deducted'; end if;
  select count(*) into v_count from public.inventory_movements where order_id=v_order and movement_type='sale' and quantity_change=-1;
  if v_count <> 1 then raise exception 'FAIL: sale inventory movement missing'; end if;

  -- Invalid quantity rows must be rejected before duplicate product rows are summed.
  v_rejected := false;
  begin
    perform public.place_order(jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',0)),
      'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,null);
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: zero quantity was accepted'; end if;

  v_rejected := false;
  begin
    perform public.place_order(jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',-1)),
      'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,null);
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: negative quantity was accepted'; end if;

  v_rejected := false;
  begin
    perform public.place_order(jsonb_build_array(
      jsonb_build_object('product_id',v_product,'quantity',2),
      jsonb_build_object('product_id',v_product,'quantity',-1)),
      'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,null);
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: mixed positive/negative duplicate quantities were accepted'; end if;

  v_rejected := false;
  begin
    perform public.place_order(jsonb_build_array(jsonb_build_object('product_id',gen_random_uuid(),'quantity',1)),
      'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,null);
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: unknown product was accepted'; end if;

  v_rejected := false;
  begin
    perform public.place_order(jsonb_build_array(jsonb_build_object('product_id',v_hidden,'quantity',1)),
      'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,null);
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: hidden product was accepted'; end if;

  v_rejected := false;
  begin
    perform public.place_order(jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',2)),
      'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,null);
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: order beyond available stock was accepted'; end if;

  -- Coupon preview: valid, expired, minimum basket and usage limit.
  select valid,discount_amount into v_valid,v_discount from public.preview_coupon(v_valid_coupon,100);
  if not v_valid or v_discount <> 10 then raise exception 'FAIL: valid coupon preview incorrect'; end if;
  select valid into v_valid from public.preview_coupon(v_expired_coupon,100);
  if v_valid then raise exception 'FAIL: expired coupon preview accepted'; end if;
  select valid into v_valid from public.preview_coupon(v_min_coupon,100);
  if v_valid then raise exception 'FAIL: below-minimum coupon preview accepted'; end if;
  select valid into v_valid from public.preview_coupon(v_limit_coupon,100);
  if v_valid then raise exception 'FAIL: exhausted coupon preview accepted'; end if;

  -- A valid coupon is rechecked and counted inside the order transaction.
  v_second_order := public.place_order(
    jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1)),
    'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,v_valid_coupon
  );
  select used_count into v_count from public.coupons where code=v_valid_coupon;
  if v_count <> 1 then raise exception 'FAIL: coupon usage counter did not increment'; end if;

  -- Last unit can be sold once; a second sequential order is rejected.
  perform public.place_order(jsonb_build_array(jsonb_build_object('product_id',v_last_unit,'quantity',1)),
    'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,null);
  v_rejected := false;
  begin
    perform public.place_order(jsonb_build_array(jsonb_build_object('product_id',v_last_unit,'quantity',1)),
      'QA Checkout User','01000000000','QA Test Street 1','Cairo','cod',null,null);
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: last unit was sold twice'; end if;

  -- Only COD is enabled until a payment provider is integrated.
  v_rejected := false;
  begin
    perform public.place_order(jsonb_build_array(jsonb_build_object('product_id',v_product,'quantity',1)),
      'QA Checkout User','01000000000','QA Test Street 1','Cairo','instapay',null,null);
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: unconfigured InstaPay was accepted'; end if;

  -- Cancel once, restore stock once, record history, and keep cancellation terminal.
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform public.admin_set_order_status(v_order,'cancelled');
  select stock into v_stock from public.products where id=v_product;
  if v_stock <> 1 then raise exception 'FAIL: cancellation did not restore one unit while the second order remains'; end if;
  select count(*) into v_count from public.inventory_movements where order_id=v_order and movement_type='return' and quantity_change=1;
  if v_count <> 1 then raise exception 'FAIL: return inventory movement missing'; end if;
  select count(*) into v_count from public.order_status_history where order_id=v_order and new_status='cancelled';
  if v_count <> 1 then raise exception 'FAIL: cancellation status history missing'; end if;

  v_rejected := false;
  begin
    update public.orders set status='confirmed' where id=v_order;
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: direct update reopened cancelled order'; end if;

  v_rejected := false;
  begin
    perform public.admin_set_order_status(v_order,'confirmed');
  exception when others then v_rejected := true; end;
  if not v_rejected then raise exception 'FAIL: admin RPC reopened cancelled order'; end if;
end;
$qa$;

rollback;
