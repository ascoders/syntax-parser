import * as React from 'react';
import { SQLAstParser, tokenConfig, Tokenizer } from '../src';

class Props {}

class State {}

const parser = new SQLAstParser();

function parse(str: string) {
  const startTime = new Date();
  const tokenizer = new Tokenizer(tokenConfig);
  const tokens = tokenizer.tokenize(str);
  const endTime1 = new Date();
  const result = parser.parse(tokens, 0);
  const endTime2 = new Date();

  // tslint:disable-next-line:no-console
  console.log('lexer time', endTime1.getTime() - startTime.getTime(), 'ms');
  // tslint:disable-next-line:no-console
  console.log('parser time', endTime2.getTime() - endTime1.getTime(), 'ms');
  // tslint:disable-next-line:no-console
  console.log('result', result);

  if (!result.success) {
    // tslint:disable-next-line:no-console
    console.log('error tokens', tokens);
  }
}

parse(`
--Blink SQL
--********************************************************************--
--Author: 黄晓锋
--CreateTime: 2018-07-06 16:09:04
--Comment: lazada测试
--********************************************************************--
CREATE VIEW trade_order_line_view AS
SELECT
  '\${venture}' AS venture,
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
          '\${venture}' IN ('TH', 'VN', 'ID'),
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
        '\${venture}' IN ('TH', 'VN', 'ID'),
        DateFormatChangeWithZone(operate_time, 'yyyy-MM-dd', 'Asia/Bangkok'),
        DATE_FORMAT(
          TO_TIMESTAMP(CAST(operate_time AS BIGINT)),
          'yyyy-MM-dd'
        )
      ) >= DATE_SUB(CURRENT_TIMESTAMP, 2)
      AND action_type = '1'
      AND UPPER(action_code) IN ('DELIVERY_ORDER_CREATE')
    GROUP BY
      trade_order_line_id
  ) tmp;

`);

export default class Page extends React.PureComponent<Props, State> {
  public static defaultProps = new Props();
  public state = new State();

  public render() {
    return <div>123123</div>;
  }
}
