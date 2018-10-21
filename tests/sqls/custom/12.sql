--中文中文中文
set odps.sql.type.system.asdw=true;

select x1.*,concat(round(x1.中文/x1.分发量*100,2),'%') 中文5,round(x1.分发量/x1.中文1,2) 中文6,round(x1.中文/x1.中文1,2) 中文7
from 
(select   x.中文3商,x.区域,x.主管组,sum(x.中文1) 中文1,sum(x.分发量) 分发量,sum(x.中文) 中文
from 
(
select a.xyz_abc, a.xyz_abc1, a.xyz_abc2
from   (select a11.xyz_abc1,a14.parent_xyz_abc2,a14.xyz_abc2,a11.xyz_abc3,a11.xyz_abc4,a11.xyz_abc5
               ,a13.xyz_abc8,a13.xyz_abc9,a13.xyz_abc,a13.xyz_abc22,a12.xyz_abc23,a12.xyz_abc19
        from  cbuads.xyz_abc20 a11
        join (select org_id,xyz_abc23,xyz_abc19  
              from cbucdm.sdfweewf 
              where  firstxyz_abc23 <= bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1)
              and  dw_end_date > bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1)
              and ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')
              ) a12 
              on (a11.sales_owner_id = a12.xyz_abc19) 
        join  (select org_id,xyz_abc9,xyz_abc,xyz_abc22 
                      ,case when xyz_abc8 in  ('中文2') then '中文3' else '中文4' end xyz_abc8
               from cbucdm.regergerg
               where xyz_abc21 <= bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1)
               and  dw_end_date > bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1)
               and ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')---------中文22
               and xyz_abc8 in  ('中文2') 
              ) a13 
              on (a12.org_id = a13.org_id) 
        join (select * from wewgweg.aaabb  
        where ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')) a14
              on (a11.leads_source_id = a14.leads_source_id)    
        where a11.ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd') 
              and a11.xyz_abc1 >= bi_udf:bi_get_date(bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1),0,'first') --中文11
           ---and substr(a11.xyz_abc1,1,7) = substr(dateadd(getdate(),-1,'dd'),1,7) 
              and a11.form in ('-', 'offline', 'pipe','selectsea','sys_dw','sys_gen','transfer','self','esb','pick','et')    
         ) a
left outer join (select * from cbuods.ewwegewg 
where ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd') ) b
on (a.xyz_abc5 = b.xyz_abc5 and a.xyz_abc2 = b.lead_source_xyz_abc23)    
group by 
      a.xyz_abc8
      ,a.xyz_abc9
      ,a.xyz_abc
      ,a.xyz_abc22
      ,a.xyz_abc23
      ,null
---分发
union all

select a13.xyz_abc8 中文8
      ,a13.xyz_abc9 中文3商
      ,a13.xyz_abc 区域
      ,a13.xyz_abc22 主管组
      ,a12.xyz_abc23 中文9
      ,null as 中文1
      ,null as 分发量
      ,count(distinct a.xyz_abc3) 中文
from (select * from cbuads.ads_cn_crm_ord_mulit_d
    where prduct_xyz_abc23 like '%中文9%'
    and attribute='new'
    and ds=to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')
    and gmt_voucher_receive >= bi_udf:bi_get_date(bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1),0,'first') --wefewf
    and execute_amount > 0
    and xyz_abc8 in  ('中文2') 
     ) a
     join (select org_id,xyz_abc23,xyz_abc19  
              from cbucdm.reherh 
              where xyz_abc21 <= bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1)
              and  dw_end_date > bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1)
              and ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')
              ) a12 
              on (a.werwer = a12.xyz_abc19) 
        join  (select org_id,xyz_abc9,xyz_abc,xyz_abc22 
                      ,case when xyz_abc8 in  ('中文2') then '中文3' else '中文4' end xyz_abc8
               from cbucdm.fddfgdg
               where xyz_abc21 <= bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1)
               and  dw_end_date > bi_udf:bi_date_add(bi_udf:bi_sys_date('yyyy-MM-dd'),-1)
               and ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')---------wqeqw
               and xyz_abc8 in  ('中文2') 
              ) a13 
              on (a12.werwer = a13.dfgdfg) 
 left outer join 
    (select xyz_abc3,create_leads_source_id,substr(coalesce(gmt_last_pick,gmt_opp_create),1,10) gmt_opp_create
    from cbucdm.dim_cn_crm_opp
    where 34t34t=1         ---sdfsdf
    and erw ='N'             ---sdfsdf
    and qweqwe='sadwd'  ---sdfweg
    and ds=to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')
    ) b
   on (a.xyz_abc3=b.xyz_abc3)
left outer join (select * from cbucdm.aaabb  
                 where ds = to_char(dateadd(getdate(),-1,'dd'),'yyyymmdd')) c
   on (b.create_leads_source_id = c.leads_source_id) 
group by 
     a13.xyz_abc8
      ,a13.xyz_abc9
      ,a13.xyz_abc
      ,a13.xyz_abc22
      ,a12.xyz_abc23
      ,null
) x
where x.中文3商 in ('中文10')
group by x.中文3商,x.区域,x.主管组
) x1
order by x1.中文3商,x1.区域,x1.主管组;