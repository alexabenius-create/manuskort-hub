-- 1. Enum för roller
create type public.app_role as enum ('free', 'pro', 'admin');

-- 2. user_roles-tabell (separat från profiles, mot privilegieeskalering)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamp with time zone not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- 3. Security definer-funktion för rollkontroll (undviker rekursiva RLS-problem)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- 4. Returnera användarens högsta tier (admin > pro > free)
create or replace function public.get_user_tier(_user_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.user_roles where user_id = _user_id and role = 'admin') then 'admin'::public.app_role
    when exists (select 1 from public.user_roles where user_id = _user_id and role = 'pro') then 'pro'::public.app_role
    else 'free'::public.app_role
  end
$$;

-- 5. RLS-policies
create policy "users_select_own_roles"
on public.user_roles
for select
to authenticated
using (auth.uid() = user_id);

create policy "admins_select_all_roles"
on public.user_roles
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "admins_insert_roles"
on public.user_roles
for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create policy "admins_update_roles"
on public.user_roles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "admins_delete_roles"
on public.user_roles
for delete
to authenticated
using (public.has_role(auth.uid(), 'admin'));