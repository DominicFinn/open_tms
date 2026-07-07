-- Add an optional free-form tag to Comment so notes can be categorized
-- (e.g. "issue", "requirement") without inferring meaning from body text.

ALTER TABLE "Comment"
  ADD COLUMN "tag" TEXT;
