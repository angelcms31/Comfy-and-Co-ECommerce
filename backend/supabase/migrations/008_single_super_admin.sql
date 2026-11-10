-- The store has exactly one Super Admin. Safe to run more than once.
--
-- 1. If there are several, the first one created (oldest date_added) stays Super Admin and the others become Admins.
-- 2. A trigger refuses a second Super Admin from then on, even for edits made straight in the database.
--    The backend checks this too (backend/app/routers/admins.py), this is the safety net.

update "user" u
set user_role_id = (select user_role_id from user_role where user_role = 'admin')
where u.user_role_id = (select user_role_id from user_role where user_role = 'super_admin')
  and u.deleted_at is null
  and u.user_id <> (
    select k.user_id from "user" k
    where k.user_role_id = (select user_role_id from user_role where user_role = 'super_admin') and k.deleted_at is null
    order by k.date_added, k.user_id
    limit 1
  );

create or replace function only_one_super_admin() returns trigger language plpgsql as $$
declare
  super_id int := (select user_role_id from user_role where user_role = 'super_admin');
begin
  if new.user_role_id = super_id and new.deleted_at is null and exists (
    select 1 from "user" u where u.user_role_id = super_id and u.deleted_at is null and u.user_id <> new.user_id
  ) then
    raise exception 'There can only be one Super Admin';
  end if;
  return new;
end;
$$;

drop trigger if exists only_one_super_admin on "user";
create trigger only_one_super_admin
  before insert or update of user_role_id, deleted_at on "user"
  for each row execute function only_one_super_admin();
