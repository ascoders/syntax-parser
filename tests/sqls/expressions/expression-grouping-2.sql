CREATE INDEX `bees`.`hive_state`
ON `hive` (`happiness` ASC, `anger` DESC)
WHERE
  `happiness` NOT NULL AND `anger` > 0
