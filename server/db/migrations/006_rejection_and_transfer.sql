-- 006_rejection_and_transfer.sql
--  * rejection_reason: why a corporator rejected an issue. Required by the API for every NEW rejection
--    (proof photos use the update's existing `photos`); NULL for older rejections, whose explanation
--    lives in `remark`.
--  * event / from_ward_id / to_ward_id: history rows are either ordinary updates or transfers of the
--    issue to another constituency ("ward" in the schema). A transfer row records who moved it and where.

ALTER TABLE issue_updates
  ADD COLUMN rejection_reason TEXT
      CHECK (rejection_reason IS NULL OR char_length(rejection_reason) BETWEEN 5 AND 500),
  ADD COLUMN event TEXT NOT NULL DEFAULT 'update'
      CHECK (event IN ('update', 'transfer')),
  ADD COLUMN from_ward_id INTEGER REFERENCES wards (id),
  ADD COLUMN to_ward_id   INTEGER REFERENCES wards (id),
  ADD CONSTRAINT issue_updates_transfer_wards
      CHECK ((event = 'transfer') = (from_ward_id IS NOT NULL AND to_ward_id IS NOT NULL));
