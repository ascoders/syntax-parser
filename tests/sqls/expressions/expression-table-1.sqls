WITH ham AS (
  SELECT type
  FROM hams
)
SELECT *
FROM inventory
  INNER JOIN ham
    ON inventory.variety = ham.type
