-- 008_ward_name_mr.sql : Marathi text for each constituency's areas (`name` stays the English text).
-- Nullable: the UI falls back to the English name when there is no Marathi one.
ALTER TABLE wards ADD COLUMN name_mr TEXT;
