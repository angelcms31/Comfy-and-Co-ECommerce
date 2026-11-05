-- Photos on refund requests, comma separated URLs like review.photos. See SCHEMA_GAPS.md #21. Safe to run more than once.
alter table refund add column if not exists photos text;
