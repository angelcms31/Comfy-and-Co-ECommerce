-- Customers can post a review without their name showing on the store. Admins still see who wrote it.
-- Safe to run more than once.
alter table review add column if not exists is_anonymous boolean not null default false;
