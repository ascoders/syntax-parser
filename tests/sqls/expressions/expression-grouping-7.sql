CREATE INDEX `bees`.`hive_state`
ON `hive` (`happiness` ASC, `anger` DESC)
WHERE
  NOT `happiness` AND `anger` IS NOT 0
