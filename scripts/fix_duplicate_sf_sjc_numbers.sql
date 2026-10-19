-- ============================================================================
-- Fix duplicate SF-Sr No. / SJC-Sr No. numbers (Semi Finished module)
-- Run this ONCE in Supabase SQL Editor for the Production-FMS project.
-- Safe to re-run: it skips work already done (backup tables use IF NOT EXISTS,
-- and the eligibility check only matches rows that are STILL duplicated).
-- ============================================================================

-- STEP 0: Backups (kept permanently as a safety net — do not drop these)
create table if not exists backup_semi_production_20261019 as select * from semi_production;
create table if not exists backup_semi_job_card_20261019 as select * from semi_job_card;
create table if not exists backup_semi_actual_20261019 as select * from semi_actual;

-- STEP 1: Build renumbering map for semi_production.
-- Only touches "SF-Sr No." groups where every row in the group has a
-- DIFFERENT product name (i.e. the number was clearly mis-assigned by the
-- serial generator, not a genuine duplicate entry of the same thing).
-- The earliest row (lowest id) in each group keeps its original number;
-- later rows get a brand-new unique number continuing after the current max.
drop table if exists tmp_sf_renumber_map;
create table tmp_sf_renumber_map as
with ranked as (
  select id, "SF-Sr No." as old_sf, "Name Of Semi Finished Good" as product,
         row_number() over (partition by "SF-Sr No." order by id) as rn,
         count(*) over (partition by "SF-Sr No.") as grp_count,
         count(distinct lower(trim("Name Of Semi Finished Good"))) over (partition by "SF-Sr No.") as distinct_products
  from semi_production
),
eligible as (
  select * from ranked where grp_count > 1 and grp_count = distinct_products and rn > 1
),
base as (
  select coalesce(max((regexp_replace("SF-Sr No.", '\D', '', 'g'))::int), 0) as max_sf
  from semi_production where "SF-Sr No." ~ '^SF-\d+$'
)
select e.id, e.old_sf, e.product, e.rn,
       'SF-' || (b.max_sf + row_number() over (order by e.id)) as new_sf
from eligible e, base b;

-- STEP 2: Point job cards and production-entry rows that match the OLD
-- (number + product name) combination to the NEW number, before renumbering
-- semi_production itself (order doesn't matter, but doing this first keeps
-- the matching based on the untouched "old_sf" value in the map).
update semi_job_card jc
set "Semi Finished Production No." = m.new_sf
from tmp_sf_renumber_map m
where jc."Semi Finished Production No." = m.old_sf
  and lower(trim(jc."Product Name")) = lower(trim(m.product));

update semi_actual sa
set "Semi Finished Production No." = m.new_sf
from tmp_sf_renumber_map m
where sa."Semi Finished Production No." = m.old_sf
  and lower(trim(sa."Product Name")) = lower(trim(m.product));

-- STEP 3: Apply the new numbers to semi_production itself.
update semi_production sp
set "SF-Sr No." = m.new_sf
from tmp_sf_renumber_map m
where sp.id = m.id;

-- STEP 4: Build renumbering map for semi_job_card, same logic as Step 1.
drop table if exists tmp_sjc_renumber_map;
create table tmp_sjc_renumber_map as
with ranked as (
  select id, "SJC-Sr No." as old_sjc, "Product Name" as product,
         row_number() over (partition by "SJC-Sr No." order by id) as rn,
         count(*) over (partition by "SJC-Sr No.") as grp_count,
         count(distinct lower(trim("Product Name"))) over (partition by "SJC-Sr No.") as distinct_products
  from semi_job_card
),
eligible as (
  select * from ranked where grp_count > 1 and grp_count = distinct_products and rn > 1
),
base as (
  select coalesce(max((regexp_replace("SJC-Sr No.", '\D', '', 'g'))::int), 0) as max_sjc
  from semi_job_card where "SJC-Sr No." ~ '^SJC-\d+$'
)
select e.id, e.old_sjc, e.product, e.rn,
       'SJC-' || (b.max_sjc + row_number() over (order by e.id)) as new_sjc
from eligible e, base b;

-- STEP 5: Point production-entry rows that match the OLD (SJC number +
-- product name) combination to the NEW SJC number.
update semi_actual sa
set "Semi Finished Job Card No." = m.new_sjc
from tmp_sjc_renumber_map m
where sa."Semi Finished Job Card No." = m.old_sjc
  and lower(trim(sa."Product Name")) = lower(trim(m.product));

-- STEP 6: Apply the new numbers to semi_job_card itself.
update semi_job_card jc
set "SJC-Sr No." = m.new_sjc
from tmp_sjc_renumber_map m
where jc.id = m.id;

-- STEP 7: Verification — these two should return ZERO rows for the
-- unambiguous groups that were fixed. Any rows still shown here are the
-- deliberately-skipped ambiguous groups (same product repeated under one
-- number) that need manual review.
select "SF-Sr No.", count(*), count(distinct lower(trim("Name Of Semi Finished Good"))) as distinct_products
from semi_production group by 1 having count(*) > 1;

select "SJC-Sr No.", count(*), count(distinct lower(trim("Product Name"))) as distinct_products
from semi_job_card group by 1 having count(*) > 1;

-- STEP 8: Cleanup the temporary mapping tables (keep the backup_* tables).
drop table if exists tmp_sf_renumber_map;
drop table if exists tmp_sjc_renumber_map;
