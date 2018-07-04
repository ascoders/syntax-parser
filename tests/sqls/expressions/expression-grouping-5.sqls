CREATE INDEX `bees`.`hive_state`
ON `hive` (`happiness` ASC, `anger` DESC)
WHERE
  `anger` > 0 AND `happiness` IS NOT NULL
