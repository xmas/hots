const _ = require('lodash')
const fs = require('fs')
require('dotenv').config();

const base = 'https://www.nexusgamingseries.org/api'
const axios = require('axios')
axios.defaults.params = {};
const api = axios.create({
    baseURL: base
})

const season = process.env.THIS_SEASON - 1

let last_season_mongo = JSON.parse(fs.readFileSync(`ngs_archive/ngs_s_${season}.json`, 'utf8'))



const storeData = (data, path) => {
    try {
        fs.writeFileSync(path, JSON.stringify(data))
    } catch (err) {
        console.error(err)
    }
}

async function start() {

    let divs = _.chain(last_season_mongo)
    .map('object.divisionConcat')
    .filter()
    .uniq()
    .value()

    let all_teams = {}

    for (let i = 0; i < divs.length; i++) {
        let div = divs[i]
        let response = await api.post('/standings/fetch/division', { "division": div, "season": season, "pastSeason": true })
        let data = response.data.returnObject
        if (!data) {
            continue
        }
        for (let i = 0; i < data.length; i++) {
            let team = data[i]
            if (team.teamName.endsWith('(Withdrawn)')) {
                team['withdrawn'] = true
                team.teamName = team.teamName.replace(' (Withdrawn)', '')
            }
            team[`season_${season}_div`] = div
        }
        let teams = _.keyBy(data, 'teamName')
        Object.assign(all_teams, teams)
    }

    storeData(all_teams, `ngs_archive/ngs_s${season}_results.json`)


    // let post_all =  _.map(last_season_mongo, async (div) => {
    //     // console.log(div)

    //     return await api.post('/standings/fetch/division', { "division": div.object.divisionConcat, "season": season, "pastSeason": true })
    //         .then((response) => {
    //             // console.log(JSON.stringify(response.data), null, 4)
    //             let data
    //             try {
    //                  data = response.data.returnObject
    //             } catch (e) {
    //                 console.log('no data')
    //                 console.log(e.error)
    //                 return
    //             }
                
                
    //             for (let i = 0; i < data.length; i++) {
    //                 let team = data[i]
    //                 if (team.teamName.endsWith('(Withdrawn)')) {
    //                     team['withdrawn'] = true
    //                     team.teamName = team.teamName.replace(' (Withdrawn)', '')
    //                 }
    //                 team[`season_${season}_div`] = div.object.divisionConcat
    //             }
    //             let teams = _.keyBy(data, 'teamName')
    //             Object.assign(all_teams, teams)
    //             console.log('added teams')
    //         })

    // })
    // Promise.all(post_all).then( () => {
    //     // console.log(all_teams)
    //     storeData(all_teams, `ngs_archive/ngs_s${season}_results.json`)
    // })

}
start().catch(console.error)
