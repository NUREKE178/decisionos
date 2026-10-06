-- `created_by` is an audit/attribution column, not an ownership column that
-- should keep a row alive. With the default `on delete no action`, Postgres
-- refuses to delete any auth.users row that ever created an organization,
-- experiment, AI insight, or report — which in practice means refusing to
-- delete almost any real user. Deleting a person's account must not cascade
-- into deleting their organization's data (other members still need it), so
-- the correct fix is `on delete set null`, not `on delete cascade`.

alter table organizations
  alter column created_by drop not null;
alter table organizations
  drop constraint organizations_created_by_fkey,
  add constraint organizations_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table experiments
  alter column created_by drop not null;
alter table experiments
  drop constraint experiments_created_by_fkey,
  add constraint experiments_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table ai_insights
  drop constraint ai_insights_created_by_fkey,
  add constraint ai_insights_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;

alter table reports
  drop constraint reports_created_by_fkey,
  add constraint reports_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
