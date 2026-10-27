-- Database setup for the login page (already run in Supabase).
-- Kept here so teammates can see how the "profiles" table works.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  email text not null unique,
  video_link text,
  score integer not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index profiles_username_unique on public.profiles (lower(username));

alter table public.profiles enable row level security;

create policy "Users read own profile"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, email)
  values (new.id, new.raw_user_meta_data->>'username', new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_taken(p_username text)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from profiles where lower(username) = lower(trim(p_username))
  );
$$;

create or replace function public.get_leaderboard()
returns table (username text, score integer)
language sql security definer set search_path = public
as $$
  select username, score from profiles order by score desc;
$$;