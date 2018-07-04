WITH RECURSIVE
  parent_of(name, parent) AS
    (SELECT name, mom FROM family UNION SELECT name, dad FROM family),
  ancestor_of_alice(name) AS
    (SELECT parent FROM parent_of WHERE name='Alice'
     UNION ALL
     SELECT parent FROM parent_of JOIN ancestor_of_alice USING(name))
SELECT family.name FROM ancestor_of_alice, family
 WHERE ancestor_of_alice.name=family.name
   AND died IS NULL
 ORDER BY born;
