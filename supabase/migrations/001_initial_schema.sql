create extension if not exists "pgcrypto";

create table if not exists hotel_settings (
  id int primary key default 1 check (id = 1),
  hotel_name text not null default 'Hotel Decent Inn',
  subtitle text not null default 'Hotel Management & Accounts System',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  gst_number text not null default '',
  currency text not null default 'INR',
  tax_percent numeric not null default 0,
  logo_url text
);

create table if not exists users (
  id text primary key,
  name text not null,
  username text not null unique,
  mobile text not null default '',
  password text not null,
  role text not null check (role in ('Admin', 'Manager')),
  active boolean not null default true
);

create table if not exists rooms (
  id text primary key,
  number text not null,
  type text not null,
  floor int not null,
  rate numeric not null,
  status text not null,
  current_guest_id text,
  current_booking_id text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guests (
  id text primary key,
  name text not null,
  mobile text not null,
  email text,
  address text,
  id_type text,
  id_number text,
  nationality text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bookings (
  id text primary key,
  code text not null,
  guest_id text not null,
  guest_name text not null,
  mobile text not null,
  email text,
  room_id text not null,
  room_number text not null,
  room_type text not null,
  check_in_date date not null,
  check_in_time text,
  check_out_date date not null,
  check_out_time text,
  adults int not null default 1,
  children int not null default 0,
  room_rate numeric not null,
  nights int not null,
  room_amount numeric not null,
  food_amount numeric not null default 0,
  room_service numeric not null default 0,
  other_charges numeric not null default 0,
  extra_charges jsonb not null default '[]'::jsonb,
  discount numeric not null default 0,
  tax_percent numeric not null default 0,
  tax_amount numeric not null default 0,
  total_amount numeric not null,
  advance_received numeric not null default 0,
  paid_amount numeric not null default 0,
  balance_amount numeric not null default 0,
  payment_mode text not null,
  payments jsonb not null default '[]'::jsonb,
  status text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transactions (
  id text primary key,
  sr_no int not null,
  date date not null,
  category text not null,
  particulars text not null,
  guest text,
  party text,
  room_number text,
  check_in date,
  check_out date,
  advance_given numeric not null default 0,
  advance_received numeric not null default 0,
  room_rent numeric not null default 0,
  room_service numeric not null default 0,
  food_kitchen numeric not null default 0,
  other_income numeric not null default 0,
  expense numeric not null default 0,
  cash numeric not null default 0,
  online numeric not null default 0,
  upi numeric not null default 0,
  card numeric not null default 0,
  total_amount numeric not null default 0,
  paid_amount numeric not null default 0,
  pending_amount numeric not null default 0,
  payment_status text not null,
  due_date date,
  remarks text,
  voided boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists expenses (
  id text primary key,
  date date not null,
  category text not null,
  description text not null,
  supplier_id text,
  supplier_name text,
  amount numeric not null,
  payment_mode text not null,
  reference text,
  receipt_url text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists suppliers (
  id text primary key,
  name text not null,
  mobile text not null default '',
  category text not null,
  address text,
  opening_balance numeric not null default 0,
  total_purchases numeric not null default 0,
  total_paid numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists advances (
  id text primary key,
  date date not null,
  person text not null,
  type text not null,
  amount numeric not null,
  purpose text,
  payment_mode text not null,
  recovered_amount numeric not null default 0,
  remaining_amount numeric not null default 0,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id text primary key,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id text primary key,
  "user" text not null,
  action text not null,
  entity text not null,
  entity_id text not null,
  field text,
  old_value text,
  new_value text,
  timestamp timestamptz not null default now()
);

create table if not exists inventory (
  id text primary key,
  name text not null,
  opening_stock numeric not null default 0,
  purchased numeric not null default 0,
  consumed numeric not null default 0,
  current_stock numeric not null default 0,
  minimum_stock numeric not null default 0,
  unit text not null,
  supplier_name text
);

create index if not exists idx_rooms_number on rooms (number);
create index if not exists idx_bookings_dates on bookings (check_in_date, check_out_date);
create index if not exists idx_transactions_date on transactions (date);
create index if not exists idx_audit_log_timestamp on audit_log (timestamp desc);

alter table hotel_settings enable row level security;
alter table users enable row level security;
alter table rooms enable row level security;
alter table guests enable row level security;
alter table bookings enable row level security;
alter table transactions enable row level security;
alter table expenses enable row level security;
alter table suppliers enable row level security;
alter table advances enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;
alter table inventory enable row level security;

create policy "anon_all_hotel_settings" on hotel_settings for all using (true) with check (true);
create policy "anon_all_users" on users for all using (true) with check (true);
create policy "anon_all_rooms" on rooms for all using (true) with check (true);
create policy "anon_all_guests" on guests for all using (true) with check (true);
create policy "anon_all_bookings" on bookings for all using (true) with check (true);
create policy "anon_all_transactions" on transactions for all using (true) with check (true);
create policy "anon_all_expenses" on expenses for all using (true) with check (true);
create policy "anon_all_suppliers" on suppliers for all using (true) with check (true);
create policy "anon_all_advances" on advances for all using (true) with check (true);
create policy "anon_all_notifications" on notifications for all using (true) with check (true);
create policy "anon_all_audit_log" on audit_log for all using (true) with check (true);
create policy "anon_all_inventory" on inventory for all using (true) with check (true);

insert into hotel_settings (id, hotel_name, subtitle, address)
values (
  1,
  'Hotel Decent Inn',
  'Hotel Management & Accounts System',
  'Sukher Rd, Shyam Nagar, Chitrakoot Nagar, Sukher, Udaipur, Rajasthan 313001'
)
on conflict (id) do nothing;
