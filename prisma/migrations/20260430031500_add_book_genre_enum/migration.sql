CREATE TYPE "BookGenre" AS ENUM (
  'fantasy',
  'horror',
  'romance',
  'adventure',
  'mystery',
  'science_fiction',
  'historical_fiction',
  'literary_fiction',
  'thriller',
  'childrens_fiction',
  'classic_literature',
  'gothic',
  'crime',
  'biography',
  'short_stories'
);

ALTER TABLE "Book"
ALTER COLUMN "genre" TYPE "BookGenre"
USING (
  CASE
    WHEN "genre" IS NULL OR btrim("genre") = '' THEN NULL
    WHEN lower("genre") LIKE '%fantasy%' THEN 'fantasy'
    WHEN lower("genre") LIKE '%horror%' THEN 'horror'
    WHEN lower("genre") LIKE '%romance%' THEN 'romance'
    WHEN lower("genre") LIKE '%adventure%' THEN 'adventure'
    WHEN lower("genre") LIKE '%mystery%' THEN 'mystery'
    WHEN lower("genre") LIKE '%science%' THEN 'science_fiction'
    WHEN lower("genre") LIKE '%historical%' THEN 'historical_fiction'
    WHEN lower("genre") LIKE '%literary%' THEN 'literary_fiction'
    WHEN lower("genre") LIKE '%thriller%' THEN 'thriller'
    WHEN lower("genre") LIKE '%children%' THEN 'childrens_fiction'
    WHEN lower("genre") LIKE '%classic%' THEN 'classic_literature'
    WHEN lower("genre") LIKE '%gothic%' THEN 'gothic'
    WHEN lower("genre") LIKE '%crime%' THEN 'crime'
    WHEN lower("genre") LIKE '%biography%' THEN 'biography'
    WHEN lower("genre") LIKE '%short%' THEN 'short_stories'
    ELSE NULL
  END
)::"BookGenre";
