--Blink SQL
--********************************************************************--
--Author: 
--CreateTime: 2018-07-06 16:09:04
--Comment: lazada测试
--********************************************************************--
CREATE VIEW trade_order_line_view AS
SELECT
  '${venture}' AS venture,
  trade_order_line_id AS trade_order_line_id,
  trade_order_id AS trade_order_id,
  seller_id AS seller_id,
  buyer_id AS buyer_id,
  sku_id AS asc_sku_id,
  item_id AS asc_item_id,
  category_id AS category_id,
  FIRST_VALUE(seller_full_name) AS seller_full_name,
  FIRST_VALUE(buyer_full_name) AS buyer_full_name,
  FIRST_VALUE(sku_info) AS sku_info,
  FIRST_VALUE(item_title) AS item_title,
  FIRST_VALUE(quantity) AS quantity,
  FIRST_VALUE(actual_fee) AS actual_fee,
  FIRST_VALUE(actual_fee_currency_code) AS actual_fee_currency_code,
  FIRST_VALUE(shipping_actual_fee) AS shipping_actual_fee,
  FIRST_VALUE(shipping_actual_fee_currency_code) AS shipping_actual_fee_currency_code,
  FIRST_VALUE(features) AS features,
  FIRST_VALUE(features_cc) AS features_cc,
  FIRST_VALUE(site_id) AS site_id,
  KEYVALUE(
    FIRST_VALUE(features),
    ';',
    ':',
    's_sp_c'
  ) AS bob_simple_sku,
  FIRST_VALUE(
    REGEXP_REPLACE(
      JSON_VALUE(sale_discount_info, '$.[*]'),
      '\\},\\{',
      '\\},,,,\\{'
    )
  ) AS sale_discount_info_tmp,
  FIRST_VALUE(
    REGEXP_REPLACE(
      JSON_VALUE(shipping_discount_info, '$.[*]'),
      '\\},\\{',
      '\\},,,,\\{'
    )
  ) AS shipping_discount_info_tmp,
  FIRST_VALUE(sale_discount_info) as sale_discount_info,
  FIRST_VALUE(shipping_discount_info) as shipping_discount_info
FROM
  lzd_id_trade_order_line
GROUP BY
  trade_order_line_id,
  trade_order_id,
  seller_id,
  buyer_id,
  sku_id,
  item_id,
  category_id;

  CREATE VIEW trade_order_line_history_view AS
SELECT
  data_time,
  trade_order_line_id,
  SUBSTRING(data_time, 1, 8) AS stat_date,
  SUBSTRING(data_time, 9, 2) AS stat_hour
FROM
  (
    SELECT
      FIRST_VALUE(
        IF(
          '${venture}' IN ('TH', 'VN', 'ID'),
          DateFormatChangeWithZone(operate_time, 'yyyyMMddHHmmss', 'Asia/Bangkok'),
          DATE_FORMAT(
            TO_TIMESTAMP(CAST(operate_time AS BIGINT)),
            'yyyyMMddHHmmss'
          )
        )
      ) AS data_time,
      trade_order_line_id AS trade_order_line_id
    FROM
      lzd_id_trade_order_line_history
    WHERE
      operate_time IS NOT NULL
      AND IF(
        '${venture}' IN ('TH', 'VN', 'ID'),
        DateFormatChangeWithZone(operate_time, 'yyyy-MM-dd', 'Asia/Bangkok'),
        DATE_FORMAT(
          TO_TIMESTAMP(CAST(operate_time AS BIGINT)),
          'yyyy-MM-dd'
        )
      ) >= DATE_SUB(CURRENTTIMESTAMP, 2)
      AND action_type = '1'
      AND UPPER(action_code) IN ('DELIVERY_ORDER_CREATE')
    GROUP BY
      trade_order_line_id
  ) tmp;

  CREATE VIEW trade_order_biz_features_view AS
SELECT
  trade_order_id,
  features,
  features_cc,
  site_id,
  KEYVALUE(features, ';', ':', '_cna') AS cookie_id,
  KEYVALUE(features, ';', ':', '_anony_id') AS anoymous_id,
  KEYVALUE(features, ';', ':', '_adid') AS adid,
  KEYVALUE(features, ';', ':', '_utdid') AS utdid
FROM
  (
    SELECT
      IF(
        '${venture}' IN ('TH', 'VN', 'ID'),
        DateFormatChangeWithZone(gmt_create, 'yyyyMMdd', 'Asia/Bangkok'),
        DATE_FORMAT(
          TO_TIMESTAMP(CAST(gmt_create AS BIGINT)),
          'yyyyMMdd'
        )
      ) AS stat_date,
      trade_order_id AS trade_order_id,
      FIRST_VALUE(features) AS features,
      FIRST_VALUE(features_cc) AS features_cc,
      FIRST_VALUE(site_id) AS site_id
    FROM
      lzd_id_trade_order_biz_features
    GROUP BY
      IF(
        '${venture}' IN ('TH', 'VN', 'ID'),
        DateFormatChangeWithZone(gmt_create, 'yyyyMMdd', 'Asia/Bangkok'),
        DATE_FORMAT(
          TO_TIMESTAMP(CAST(gmt_create AS BIGINT)),
          'yyyyMMdd'
        )
      ),
      trade_order_id
  ) tmp;

  CREATE VIEW trade_order_view AS
SELECT
  trade_order_id,
  KEYVALUE(features, ';', ':', 'plt') AS `type`,
  TRIM(
    CASE
      WHEN KEYVALUE(features, ';', ':', 'plt') IN ('1') THEN CONCAT(
        COALESCE(
          LOWER(
            JSON_VALUE(
              REGEXP_REPLACE(KEYVALUE(features, ';', ':', 'di'), '#3B', ':'),
              '$.wt'
            )
          ),
          'unknown'
        ),
        'App'
      )
      WHEN KEYVALUE(features, ';', ':', 'plt') IN ('2') THEN 'mobile'
      WHEN KEYVALUE(features, ';', ':', 'plt') IN ('3') THEN 'desktop'
    END
  ) AS client_type,
  pminfo,
  other_order_info,
  KEYVALUE(features, ';', ':', 'ttid') as ttid
FROM
  (
    SELECT
      trade_order_id AS trade_order_id,
      buyer_id AS buyer_id,
      snapshot_id,
      site_id,
      FIRST_VALUE(features) AS features,
      FIRST_VALUE(
        REGEXP_REPLACE(
          SUBSTRING(
            REGEXP_REPLACE(
              KEYVALUE(other_order_info, ';', ':', 'pminfo'),
              '#3B',
              ':'
            ),
            2,
            CHAR_LENGTH(
              REGEXP_REPLACE(
                KEYVALUE(other_order_info, ';', ':', 'pminfo'),
                '#3B',
                ':'
              )
            ) - '2'
          ),
          '\\},\\{',
          '\\},,,,\\{'
        )
      ) AS pminfo,
      FIRST_VALUE(other_order_info) AS other_order_info
    FROM
      lzd_id_trade_order
    WHERE
      gmt_create IS NOT NULL
      AND IF(
        '${venture}' IN ('TH', 'VN', 'ID'),
        DateFormatChangeWithZone(gmt_create, 'yyyy-MM-dd', 'Asia/Bangkok'),
        DATE_FORMAT(
          TO_TIMESTAMP(CAST(gmt_create AS BIGINT)),
          'yyyy-MM-dd'
        )
      ) >= DATE_SUB(CURRENTTIMESTAMP, 7)
    GROUP BY
      trade_order_id,
      buyer_id,
      snapshot_id,
      site_id
  ) tmp;
INSERT INTO
  test_dwd_lazada_trd_fulfillment_create_ri
SELECT
  venture,
  stat_date,
  stat_hour,
  trade_order_line_id,
  trade_order_id,
  seller_id,
  buyer_id,
  asc_sku_id,
  asc_item_id,
  category_id,
  seller_full_name,
  buyer_full_name,
  sku_info,
  item_title,
  quantity,
  IF(venture = 'VN', actual_fee, actual_fee / 100),
  actual_fee_currency_code,
  features,
  features_cc,
  site_id,
  biz_features,
  biz_features_cc,
  biz_site_id,
  `type`,
  cookie_id,
  anoymous_id,
  adid,
  utdid,
  bob_simple_sku,
  venture_category1_id,
  venture_category1_name_en,
  venture_category2_id,
  venture_category2_name_en,
  venture_category3_id,
  venture_category3_name_en,
  venture_category4_id,
  venture_category4_name_en,
  venture_category5_id,
  venture_category5_name_en,
  venture_category6_id,
  venture_category6_name_en,
  data_time,
  client_type,
  IF(
    venture = 'VN',
    actual_fee_usd,
    actual_fee_usd / 100
  ),
  app_version,
  industry_id,
  industry_name,
  regional_category1_name,
  regional_category2_name,
  regional_category3_name,
  business_type_level2,
  IF(
    venture = 'VN',
    shipping_actual_fee,
    shipping_actual_fee / 100
  ),
  shipping_actual_fee_currency_code,
  IF(
    venture = 'VN',
    loyalty_discount_amount,
    loyalty_discount_amount / 100
  ),
  IF(
    venture = 'VN',
    store_credit_amount,
    store_credit_amount / 100
  ),
  IF(
    venture = 'VN',
    giftcard_amount,
    giftcard_amount / 100
  ),
  IF(
    venture = 'VN',
    bundle_discount_amount,
    bundle_discount_amount / 100
  ),
  IF(
    venture = 'VN',
    voucher_discount_amount,
    voucher_discount_amount / 100
  ),
  IF(
    venture = 'VN',
    cart_rule_discount_amount,
    cart_rule_discount_amount / 100
  ),
  IF(
    venture = 'VN',
    cr_no_money_discount_amount,
    cr_no_money_discount_amount / 100
  ),
  IF(
    venture = 'VN',
    loyalty_shipping_fee_discount_amount,
    loyalty_shipping_fee_discount_amount / 100
  ),
  IF(
    venture = 'VN',
    shipping_fee_discount_amount,
    shipping_fee_discount_amount / 100
  ),
  promotion_attributes,
  spread_code,
  IF(
    venture = 'VN',
    discount_amount_by_platform,
    discount_amount_by_platform / 100
  ),
  IF(
    venture = 'VN',
    (
      actual_fee + loyalty_discount_amount + store_credit_amount + giftcard_amount + discount_amount_by_platform
    ),
    (
      actual_fee + loyalty_discount_amount + store_credit_amount + giftcard_amount + discount_amount_by_platform
    )
  ) AS actual_gmv,
 
  CONCAT(trade_order_id, asc_sku_id) AS order_id,
  CONCAT(trade_order_id, seller_id) AS mord_id,
  regional_category_key
FROM
  t