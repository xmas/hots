const _ = require('lodash')
const fs = require('fs')

const base = 'https://www.nexusgamingseries.org/api'
const axios = require('axios')
axios.defaults.params = {};
const api = axios.create({
    baseURL: base
})

const season = 13

let last_season_mongo = JSON.parse(fs.readFileSync(`ngs_archive/ngs_s_${season}.json`, 'utf8'))


let all_teams = {}

const storeData = (data, path) => {
    try {
        fs.writeFileSync(path, JSON.stringify(data))
    } catch (err) {
        console.error(err)
    }
}

async function start() {

    let post_all =  _.map(last_season_mongo, async (div) => {
        // console.log(div)

        return await api.post('/standings/fetch/division', { "division": div.object.divisionConcat, "season": season, "pastSeason": true })
            .then((response) => {
                // console.log(JSON.stringify(response.data), null, 4)

                let data = response.data.returnObject
                
                for (let i = 0; i < data.length; i++) {
                    let team = data[i]
                    if (team.teamName.endsWith('(Withdrawn)')) {
                        team['withdrawn'] = true
                        team.teamName = team.teamName.replace(' (Withdrawn)', '')
                    }
                    team[`season_${season}_div`] = div.object.divisionConcat
                }
                let teams = _.keyBy(data, 'teamName')
                Object.assign(all_teams, teams)
                console.log('added teams')
            })

    })
    Promise.all(post_all).then( () => {
        // console.log(all_teams)
        storeData(all_teams, `ngs_archive/ngs_s${season}_results.json`)
    })

}
start().catch(console.error)
