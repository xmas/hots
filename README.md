# hots

## Team Level Stuff
 node download.js --division dwest.json -d data/*
 node stats.js -d data/* --team "The Nine Avatara" 


## NGS Level Stuff
It is now season 20

update `.env` to `THIS_SEASON=20`
update `ngs/.env` to `THIS_SEASON=20`

it's season `20` so get the season `19` stuff

* Get the last season results from Mongo
in "archives" filter for `{type: 'division',season: 19}`
save as `ngs_s_19.json`

* Get the last season teams from Mongo
* in archive filter for `{type: "team", season: 19}`
save `season_19_teams.json`

* Get the last season rankings that have to be calculated
* // Update to current season
`cd ngs`
`node get_ngs_results.js`
* produces `ngs_s19_results.json`

* From the `ngs/` directory
`node make_ngs_spreadsheet.js`
> It does some caching and things from Heroes Profile for the smurf detector. I have some wonky code... 
> Run it a few times.
`node make_ngs_spreadsheet.js`
> And again
`node make_ngs_spreadsheet.js`

This makes `ngs/ngs_teams.csv` for upload to the spreadsheet.