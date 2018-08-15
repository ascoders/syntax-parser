SELECT supplier_id,
         airline,
         dep_cities,
         arr_cities,
         count(1) AS total_count
FROM trip_tdp.s_trip_ie_bonus
GROUP BY  supplier_id, airline, dep_cities, arr_cities limit 100;