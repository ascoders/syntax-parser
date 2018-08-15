SELECT TABLE0.日期, TABLE0.总取件量, TABLE1.App取件量,concat(round(TABLE1.App取件量/TABLE0.总取件量 * 100,2),'%') as App占比
FROM 
    (SELECT COUNT(DISTINCT(ope.fulfil_task_id)) AS 总取件量,
         to_char(ope.gmt_create, 'yyyy-mm-dd') AS 日期
    FROM cnods.s_td_operation_delta ope
    WHERE ope.oper_code = 'courierArrive'
    GROUP BY  to_char(ope.gmt_create,'yyyy-mm-dd') ) TABLE0
LEFT JOIN 
    (SELECT COUNT(DISTINCT(ope.fulfil_task_id)) AS App取件量,
         to_char(ope.gmt_create, 'yyyy-mm-dd') AS 日期_1
    FROM cnods.s_td_operation_delta ope
    WHERE ope.oper_code = 'courierArrive'
            AND get_json_object(ope.app_client_info, '$.pkgName') = '菜鸟包裹侠'
    GROUP BY  to_char(ope.gmt_create,'yyyy-mm-dd') ) TABLE1
ON TABLE0.日期 = TABLE1.日期_1
ORDER BY TABLE0.日期