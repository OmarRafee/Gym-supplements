create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name);
  return new;
end;
$$;

revoke all on function private.sync_profile_from_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function private.sync_profile_from_auth_user();

insert into public.profiles (id, email, full_name)
select
  u.id,
  u.email,
  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(u.email, ''), '@', 1))
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name);