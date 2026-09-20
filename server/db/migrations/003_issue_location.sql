-- 003_issue_location.sql : where the issue is (WGS84 decimal degrees, from GPS or a map click).
-- Nullable because issues filed before this migration have no location; the API
-- requires it for every NEW submission. Either both columns are set or neither.

ALTER TABLE issues
  ADD COLUMN latitude  DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION,
  ADD CONSTRAINT issues_latitude_range  CHECK (latitude  BETWEEN  -90 AND  90),
  ADD CONSTRAINT issues_longitude_range CHECK (longitude BETWEEN -180 AND 180),
  ADD CONSTRAINT issues_location_pair   CHECK ((latitude IS NULL) = (longitude IS NULL));
