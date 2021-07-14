const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const _ = require('lodash')
const ObjectsToCsv = require('objects-to-csv');
const fs = require('fs')

const base = 'http://nexusgamingseries.org/api'
const axios = require('axios')
axios.defaults.params = {};
const api = axios.create({
    baseURL: base
})

let s11 = JSON.parse(fs.readFileSync('ngs_s_11.json', 'utf8'))


let all_teams = {}

const storeData = (data, path) => {
    try {
        fs.writeFileSync(path, JSON.stringify(data))
    } catch (err) {
        console.error(err)
    }
}

async function start() {

    let post_all =  _.map(s11, async (div) => {

        return await api.post('/standings/fetch/division', { "division": div.object.divisionConcat, "season": 11, "pastSeason": true })
            .then((response) => {
                // console.log(response.data)
                let data = response.data.returnObject
                for (let i = 0; i < data.length; i++) {
                    let team = data[i]
                    if (team.teamName.endsWith('(Withdrawn)')) {
                        team['withdrawn'] = true
                        team.teamName = team.teamName.replace(' (Withdrawn)', '')
                    }
                    team["season_11_div"] = div.object.divisionConcat
                }
                let teams = _.keyBy(data, 'teamName')
                Object.assign(all_teams, teams)
                console.log('added teams')
            })

    })
    Promise.all(post_all).then( () => {
        // console.log(all_teams)
        storeData(all_teams, 'ngs_s11_results.json')
    })

}
start().catch(console.error)
