INSERT INTO test_dwi_pub_hbd_slr_dtr_002 SELECT
  concat_ws(
    '\u0004',
    concat(
      SUBSTRING(md5(concat(shop_id, '111111')), 1, 4),
      ':md5'
    ),
    '93206:app',
    concat('ddd:', stat_date)
  ) as rowkey,
  count(1) as pv,
  COUNT(DISTINCT visitor_id) as uv,
  COUNT(
    DISTINCT CASE
      WHEN url_type = 'ipv' THEN visitor_id
      ELSE NULL
    END
  ) AS ipv FROM (
    SELECT
      stat_date,
      stat_hour,
      visitor_id,
      url_shop as shop_id,
      url_type,
      DateFormatChangeWithZone(stat_date, 'yyyyMMdd', 'yyyyMMdd') as tmp FROM dwd_log_aplus_shop_ri union ALL SELECT
      stat_date,
      stat_hour,
      visitor_id,
      shop_id,
      url_type,
      DateFormatChangeWithZone(stat_date, 'yyyyMMdd', 'yyyyMMdd') as tmp FROM
      dwd_log_usertrack_shop_ri
  ) t
group by
  concat_ws(
    '\u0004',
    concat(
      SUBSTRING(md5(concat(shop_id, '111111')), 1, 4),
      ':md5'
    ),
    '93206:app',
    concat('ddd:', stat_date)
  ) ;