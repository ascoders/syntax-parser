select 
id
,label
,parent_id
,level
from(
SELECT
 aaa as id 
,aaaa as label
,'root' as parent_id
,1 as level
FROM 
cccc
group by aaaa
,aaaa
union all 
SELECT
 f_org_4_name as id 
,f_org_4_name as label
,aaaa as parent_id
,2 as level
FROM 
cccc
group by f_org_4_name
,f_org_4_name
,aaaa
)tmp