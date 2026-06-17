-- MentorHub Database Schema
-- Supabase (PostgreSQL)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  full_name text not null,
  role text not null check (role in ('mentor', 'student')),
  avatar_url text,
  bio text,
  topics text[] default '{}',
  price_per_hour integer,
  rating numeric(2,1) default 0.0,
  reviews_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Bookings table
create table public.bookings (
  id uuid default uuid_generate_v4() primary key,
  mentor_id uuid references public.profiles(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  booking_date date not null,
  time_slot text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  description text,
  created_at timestamptz default now()
);

-- Reviews table
create table public.reviews (
  id uuid default uuid_generate_v4() primary key,
  booking_id uuid references public.bookings(id) on delete cascade not null,
  mentor_id uuid references public.profiles(id) on delete cascade not null,
  student_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamptz default now()
);

-- Schedule table (mentor availability)
create table public.schedule (
  id uuid default uuid_generate_v4() primary key,
  mentor_id uuid references public.profiles(id) on delete cascade not null,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null,
  end_time time not null,
  is_active boolean default true
);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.bookings enable row level security;
alter table public.reviews enable row level security;
alter table public.schedule enable row level security;

-- Profiles policies
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Bookings policies
create policy "Users can view own bookings"
  on public.bookings for select
  using (auth.uid() = mentor_id or auth.uid() = student_id);

create policy "Students can create bookings"
  on public.bookings for insert
  with check (auth.uid() = student_id);

create policy "Mentors can update booking status"
  on public.bookings for update
  using (auth.uid() = mentor_id);

-- Reviews policies
create policy "Reviews are viewable by everyone"
  on public.reviews for select
  using (true);

create policy "Students can create reviews for their bookings"
  on public.reviews for insert
  with check (auth.uid() = student_id);

-- Schedule policies
create policy "Schedule viewable by everyone"
  on public.schedule for select
  using (true);

create policy "Mentors can manage own schedule"
  on public.schedule for all
  using (auth.uid() = mentor_id);

-- Function to update mentor rating on new review
create or replace function public.update_mentor_rating()
returns trigger as $$
begin
  update public.profiles
  set rating = (
    select coalesce(avg(r.rating), 0)
    from public.reviews r
    where r.mentor_id = NEW.mentor_id
  ),
  reviews_count = (
    select count(*)
    from public.reviews r
    where r.mentor_id = NEW.mentor_id
  )
  where id = NEW.mentor_id;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_review_created
  after insert on public.reviews
  for each row
  execute function public.update_mentor_rating();
