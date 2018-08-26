SELECT *
FROM hats
WHERE
  hat OR (shirt AND (shoes OR wig) AND pants)
