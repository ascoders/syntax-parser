SELECT recommend_cnt_per_capita AS 人均推荐品牌数,
         exposure_cnt_per_capita AS 人均曝光品牌数 ,
         click_cnt_per_capita AS 人均点击品牌数 ,
         recall_rate AS 品牌推荐召回率 ,
         accuracy_rate AS 品牌推荐准确率 ,
         cover_rate AS 品牌推荐覆盖率,
         ds
FROM wl_need.gb_brand_recommend_target;