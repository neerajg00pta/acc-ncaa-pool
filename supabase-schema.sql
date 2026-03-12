-- March Madness Squares Pool schema

-- Config: single row, board state
create table config (
  id int primary key default 1 check (id = 1),
  board_locked boolean not null default false,
  max_squares_per_person int not null default 10,
  row_numbers int[] default null,
  col_numbers int[] default null
);

insert into config (id) values (1);

-- Users
create table users (
  id text primary key,
  name text not null,
  code text not null unique,
  admin boolean not null default false,
  paid boolean not null default false,
  created_at timestamptz not null default now()
);

-- Squares
create table squares (
  row int not null,
  col int not null,
  user_id text not null references users(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (row, col)
);

-- Games
create table games (
  id int primary key,
  round text not null,
  team_a text not null default '',
  team_b text not null default '',
  score_a int default null,
  score_b int default null
);

-- Seed 63 games
insert into games (id, round) values
  (1,'R64'),(2,'R64'),(3,'R64'),(4,'R64'),(5,'R64'),(6,'R64'),(7,'R64'),(8,'R64'),
  (9,'R64'),(10,'R64'),(11,'R64'),(12,'R64'),(13,'R64'),(14,'R64'),(15,'R64'),(16,'R64'),
  (17,'R64'),(18,'R64'),(19,'R64'),(20,'R64'),(21,'R64'),(22,'R64'),(23,'R64'),(24,'R64'),
  (25,'R64'),(26,'R64'),(27,'R64'),(28,'R64'),(29,'R64'),(30,'R64'),(31,'R64'),(32,'R64'),
  (33,'R32'),(34,'R32'),(35,'R32'),(36,'R32'),(37,'R32'),(38,'R32'),(39,'R32'),(40,'R32'),
  (41,'R32'),(42,'R32'),(43,'R32'),(44,'R32'),(45,'R32'),(46,'R32'),(47,'R32'),(48,'R32'),
  (49,'S16'),(50,'S16'),(51,'S16'),(52,'S16'),(53,'S16'),(54,'S16'),(55,'S16'),(56,'S16'),
  (57,'E8'),(58,'E8'),(59,'E8'),(60,'E8'),
  (61,'F4'),(62,'F4'),
  (63,'CHAMP');

-- Seed admin user
insert into users (id, name, code, admin, paid) values
  ('u1', 'Neeraj', 'neeraj2025', true, true);

-- Disable RLS for simplicity (casual pool app, anon key is fine)
alter table config enable row level security;
alter table users enable row level security;
alter table squares enable row level security;
alter table games enable row level security;

create policy "anon read/write config" on config for all using (true) with check (true);
create policy "anon read/write users" on users for all using (true) with check (true);
create policy "anon read/write squares" on squares for all using (true) with check (true);
create policy "anon read/write games" on games for all using (true) with check (true);
