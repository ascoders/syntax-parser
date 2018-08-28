SELECT  user_id,user_nick,company_name,test_config_id,test_total_score,is_passed
FROM    (
            SELECT  user_id
                    ,test_config_name
                    ,test_config_id
                    ,test_total_score
                    ,is_passed
                    ,ROW_NUMBER() OVER ( PARTITION BY user_id , test_config_id ORDER BY CAST ( test_total_score AS DOUBLE ) DESC ) AS rn
            FROM    crm_cdm.dwd_tb_crm_servr_tst_df
            WHERE   ds = TO_CHAR(DATEADD(GETDATE() , - 1 ,'dd') ,'yyyymmdd')
        ) t1
LEFT OUTER JOIN (
                    SELECT  user_id as user_id1
                            ,user_nick
                            ,company_name
                    FROM    aaa.bb_cc_dd_ee
                    WHERE   ds = TO_CHAR(DATEADD(GETDATE() , - 1 ,'dd') ,'yyyymmdd')
                ) t2
ON      t1.user_id = t2.user_id1
WHERE t1.rn = 1