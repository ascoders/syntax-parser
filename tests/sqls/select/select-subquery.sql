SELECT a.color
FROM (
  SELECT b.color
  FROM bananas b
) z LEFT JOIN apples a
ON a.color = b.color
