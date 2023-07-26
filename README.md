# hots

## Team Level Stuff
 node download.js --division dwest.json -d data/*
 node stats.js -d data/* --team "The Nine Avatara" 


## NGS Level Stuff

* Get the last season results from Mongo
in "archives" filter for `{type: 'division',season: 12}`
save as `ngs_s_12.json`

* Get the last season teams from Mongo
* in archive filter for `{type: "team", season: 13}`
save `season_14_teams.json`

* Get the last season rankings that have to be calculated
* // Update to current season
node get_ngs_results.js
* produces `ngs_s11_results.json`