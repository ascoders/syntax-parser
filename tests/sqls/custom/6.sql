set odps.instance.priority=0;
set odps.sql.type.system.odps2 = true;


SELECT
SUM(case when A.first_frame_rendering_time >0 and B.conn_type="http2" then 1 end) as player_http2_pv,
SUM(case when A.first_frame_rendering_time <= 1000 and A.first_frame_rendering_time >0 and B.conn_type="http2" then 1 end) as player_http2_less_than_1000_pv,
SUM(case when A.first_frame_rendering_time >0 and (B.conn_type="quicplain") then 1 end) as player_quic_pv,
SUM(case when A.first_frame_rendering_time <= 1000 and A.first_frame_rendering_time >0 and (B.conn_type="quicplain") then 1 end) as player_quic_less_than_1000_pv, 
SUM(case when A.abnormal_total_time >=100 and A.abnormal_count >0 and (B.conn_type="quicplain") then 1 end) as quic_labnormal_total_pv,
SUM(case when A.abnormal_total_time >=100 and A.abnormal_count >0 and (B.conn_type="http2") then 1 end) as http2_labnormal_total_pv,
A.province ,
A.school 
FROM
(select 
KEYVALUE(args,',', '=', 'business_type') AS business_type,
KEYVALUE(args,',', '=', 'player_type') AS player_type,
KEYVALUE(args,',', '=', 'play_token') AS play_token, 
KEYVALUE(args,',', '=', 'first_frame_rendering_time') AS first_frame_rendering_time,
KEYVALUE(args,',', '=', 'user_first_frame_time') AS user_first_frame_time,
KEYVALUE(args,',', '=', 'abnormal_count') AS abnormal_count,
KEYVALUE(args,',', '=', 'abnormal_total_time') AS abnormal_total_time,
province ,
school 
FROM
wireless_wdm.dwd_user_track
where 
product = "taobao"
AND event_type='cntrl'
AND arg1 = "Page_Video_Button-PlayExperience"
AND ds = '20180810' 
AND app_version='7.11.5.5'
AND (KEYVALUE(args,',', '=', 'business_type') = "DWVideo" )
AND (KEYVALUE(args,',', '=', 'player_type') = "ijkplayer" )
AND (KEYVALUE(args,',', '=', 'is_usecache') = "1" )
AND (KEYVALUE(args,',', '=', 'is_tbnet') = "1" )
AND province in ('浙江省')
AND school in ('移动','联通','电信')
)A
INNER JOIN ( select 
KEYVALUE(args,',', '=', 'playToken') AS play_token,
app_version,
KEYVALUE(args,',', '=', 'connType') AS conn_type

from
wireless_wdm.dwd_user_track 
where 
product = "taobao"
AND event_type='cntrl'
AND (arg1 = "Page_Video_Button-TBNetStatistic")
AND ds = '20180810' 
AND app_version='7.11.5.5'
AND province in ('浙江省','广东省','贵州省')
AND school in ('移动','联通','电信')


)B ON (A.play_token = B.play_token) group by A.province ,A.school ;