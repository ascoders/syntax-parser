select 
	ccw                        
    ,ccd_ccd               
    ,ccd_ccd                   
    ,ccd_ccd            
    ,ccd_ccd           
    ,ccd_ccd           
    ,ccd_ccd                
    ,ccd_ccd             
    ,ccd_ccd            
    ,ccd_ccd        
    ,ccd_ccd                  
    ,ccd_ccd              
    ,ccd_ccd                 
    ,ccd_ccd              
    ,ccd_ccd        
    ,ccd_ccd           
    ,ccd_ccd            
    ,ccd_ccd            
    ,ccd_ccd          
    ,ccd_ccd                   
    ,ccd_ccd                 
    ,ccd_ccd                
    ,ccd_ccd                
    ,ccd_ccd                
    ,ccd_ccd           
    ,ccd_ccd                
    ,ccd_ccd        
    ,ccd        
    ,ccd 
    ,case when cccc = 1 then '暗黑破坏神'
          when cccc = 2 then '暗黑破坏神'
          when cccc = 3 then '暗黑破坏神' else 'null' end as ccd
	,case when bc_type in (1,2) then '暗黑破坏神'
		  when bc_type = 0 then '暗黑破坏神' else 'null' end as bc_type
    ,substr(regexp_replace(create_time,'-',''),1,8) as date_id
    ,register_type
	,punish_status_id
from(
select *  
from cco_busi.dwd_tb_gm_visit_df
where 
ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')
)a 
left outer join(
select user_id as seller_id,ccd,bc_type from tbcdm.dim_tb_seller where ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')
)b 
on cast(a.user_id as bigint)= b.seller_id
left outer join(
select punish_id as qq,rule_code,rule_name
 	,case when ccd = 0 then  '暗黑破坏神'
		  when ccd = 1 then  '暗黑破坏神'
		  when ccd = 2 then  '暗黑破坏神'
		  when ccd = 4 then  '暗黑破坏神'
		  when ccd = 5 then  '暗黑破坏神'
		  when ccd = 6 then  '暗黑破坏神'
		  when ccd = 7 then  '暗黑破坏神'
		  when ccd = 8 then  '暗黑破坏神'
		  when ccd = 9 then  '暗黑破坏神'
		  when ccd = 10 then '暗黑破坏神'
		  when ccd = 11 then '暗黑破坏神' else 'null' end as ccd
from crm_cdm.dwd_tb_crm_punish_df
  where ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')
  and substr(create_time,1,10)>= to_char(dateadd(getdate(),-365,'dd'),'yyyy-mm-dd')
)c
on cast(a.aa as bigint) = c.qq