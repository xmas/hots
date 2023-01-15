const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const _ = require('lodash')
const ObjectsToCsv = require('objects-to-csv');
const fs = require('fs')
require('dotenv').config();
const jsonl = require("node-jsonl");

const base = 'http://nexusgamingseries.org/api'
const axios = require('axios')
axios.defaults.params = {};
const api = axios.create({
    baseURL: base
})

// const { std } = require('mathjs')
const maths = require('mathjs');
const { exit } = require('process');

const hp_base = 'https://api.heroesprofile.com/api'
axios.defaults.params = {};
const hp_api = axios.create({
    baseURL: hp_base
})
const hp_api_key = process.env.HEROES_PROFILE_TOKEN
hp_api.interceptors.request.use((config) => {
    config.params = config.params || {};
    config.params.apiKey = hp_api_key;
  
    config.params['api_token'] = process.env.HEROES_PROFILE_TOKEN
    return config;
});


const agg = [
    {
        '$match': {
            'questionnaire.registered': true
        }
    }, {
        '$lookup': {
            'from': 'users',
            'localField': 'teamMembers.displayName',
            'foreignField': 'displayName',
            'as': 'teamDetails'
        }
    }
];


const db_name = "heroku_8jbv3vlb"

const last_season = process.env.THIS_SEASON - 1
let last_season_ranks = JSON.parse(fs.readFileSync(`ngs_archive/ngs_s${last_season}_results.json`, 'utf8'))
let last_season_teams = JSON.parse(fs.readFileSync(`ngs_archive/season_${last_season}_teams.json`, 'utf8'))
last_season_teams = _.keyBy(last_season_teams, (team) => { return team.object.teamName_lower })

const player_level_file = "ngs_archive/ngs_player_level_cache.jsonl"
const player_detail_file = "ngs_archive/ngs_player_detail_cache.jsonl"
let smurfs = []
let unranked = []

let divs = _.groupBy(last_season_ranks, `season_${last_season}_div`)

let div_spread = _.map(divs, (div, div_name) => {

    let points = _.chain(div).filter((team) => {
        // console.log(team.teamName, team.points)
        // console.log(team.teamName, team.teamName.includes('Withdrawn')) 
        let is_withdrawn = team.teamName.toLowerCase().includes('withdrawn') || team['withdrawn']
        // if (is_withdrawn)
        //     console.log(team)
        return !is_withdrawn

    }).map('points').value()

    return {
        div: div_name,
        points: points,
        max: Math.max(...points),
        min: Math.min(...points),
        mean: maths.mean(points),
        stdev: maths.std(points)
    }
})


new ObjectsToCsv(div_spread).toDisk(`div_spread.csv`);
const last_season_spread = _.keyBy(div_spread, `div`)

let player_levels = {}
let player_details = {}



async function readPlayerCache(filepath, obj, key) {
    const rl = jsonl.readlines(filepath)

    while (true) {
        const { value, done } = await rl.next()
        if (done) break;
        // console.log(value); // value => T
        obj[value[key]] = value
    }
}


async function run() {
    try {
        await readPlayerCache(player_level_file, player_levels, 'battletag')
        await readPlayerCache(player_detail_file, player_details, 'battletag')
        let teams = []

        const client = await MongoClient.connect(
            'mongodb+srv://neoneROprod:f88IfzGEopyW6VXi@cluster1.tumzk.mongodb.net/myFirstDatabase?authSource=admin&replicaSet=atlas-8v96lc-shard-0&w=majority&readPreference=primary&appname=MongoDB%20Compass&retryWrites=true&ssl=true',
            { useNewUrlParser: true, useUnifiedTopology: true })

        let raw_teams = await client.db(db_name).collection('teams').aggregate(agg).toArray()

        client.close();

        for (let i = 0; i < raw_teams.length; i++) {
            let raw_team = raw_teams[i]
            let team_data = await processTeam(raw_team)
            teams.push(team_data)

        }
        console.log(`Currently there are ${teams.length} teams registered`)
        teams = _.filter(teams)
        teams = _.map(teams, (team) => {
            // console.log(team)
            if (team['player_info']) {
                delete team.player_info
                delete team.teamName_lower
                // console.log(Object.keys(team))

            }
            // team['player_info'] = "null"
            return team
        })

        new ObjectsToCsv(teams).toDisk(`ngs_teams.csv`);
        new ObjectsToCsv(smurfs).toDisk(`smurfs.csv`);
        new ObjectsToCsv(unranked).toDisk(`unranked.csv`);

        // console.log(raw_teams)
    } catch (e) {
        console.log(e)
    }

}
run().catch(console.dir);

async function processTeam(team) {
    if (!team) {
        console.log(`UNDEFINED TEAM FOUND`)
        console.log(team)
        process.exit()
    }
    // if (team.teamName != 'Tricky Gooses') {
    //     return
    // }
    const last_season_ranks_data = last_season_ranks[team.teamName]
    // console.log(last_season_ranks_data)
    Object.assign(team, last_season_ranks_data)

    let team_data = await parseTeam(team)
    // console.log('data added to teams list')
    team_data = analyzeTeamChange(team_data)

    return team_data
}

async function analyzeTeamChange(team) {

    const last_season = last_season_teams[team.teamName_lower]
    if (!last_season) {
        return team
    }

    // console.log(team)
    // console.log(last_season)

    let current_players = _.map(team.player_info, 'name')
    let past_players = _.map(last_season.object.teamMembers, "displayName")
    // console.log(current_players)
    // console.log(past_players)

    // console.log('returning players')
    // console.log(_.intersection(current_players, past_players))

    // console.log('new players')
    // console.log(_.difference(current_players, past_players))

    // console.log('dropped players')
    // console.log(_.difference(past_players, current_players))

    let new_players = _.difference(current_players, past_players)
    new_players = _.map(new_players, (player) => {
        let info = _.find(team.player_info, ['name', player])
        return `${player}(${info.rank})`

    })
    // console.log(new_players)

    team['returning_players'] = _.chain(current_players).intersection(current_players, past_players).join(", ").value()
    team['dropped_players'] = _.chain(past_players).difference(current_players).join(", ").value()
    team['added_players'] = new_players.join(", ")
    // console.log(team)
    return team
}

async function smurfDetectPlayer(player, team) {
    let level
    try {
        let result = player_levels[player.displayName]
        if (!result) {
            result = await hp_api.get(`/Player?battletag=${encodeURIComponent(player.displayName)}&region=1&api_token=${hp_api_key}`)
            fs.appendFile(player_level_file, JSON.stringify(result.data) + "\n", function (err) {
                if (err) return
                // console.log(err['response'] );

            });

        }
        level = result.account_level
    } catch (e) {
        // console.log(e.response)
    }
    // console.log(player.hlRankMetal)
    if (level > 300) {
        // console.log(`NOT A SMURF RETURN: HIGH LEVEL ${player.displayName} level: ${level}`)
        return
    } else {
        // console.log(`${player.displayName} level: ${level}`)

    }

    try {
        let result = player_details[player.displayName]
        if (!result) {
            console.log(`no player details for ${player.displayName} level: ${level}`)
            result = await hp_api.get(`/Player/Hero/All?battletag=${encodeURIComponent(player.displayName)}&region=1&game_type=${encodeURIComponent("Storm League")}&api_token=${hp_api_key}`)
            result = result.data
            result['battletag'] = player.displayName
            fs.appendFile(player_detail_file, JSON.stringify(result) + "\n", function (err) {
                if (err) return
                // console.log(err.data);

            });
        }
        // console.log(result)
        let storm = result["Storm League"]
        // console.log(_.keys(storm))
        let win_rate = _.chain(storm).map("win_rate").mean().value()

        // console.log(team_name)
        // _.set(team['potentialSmurfs'],  
        console.log(`${player.displayName} level: ${level} win_rate: ${Math.round(win_rate * 100) / 100}% team: ${team.teamName_lower}`)
        smurfs.push({
            displayName: player.displayName,
            level: level,
            win_rate: Math.round(win_rate * 100) / 100 + "%",
            team: team.teamName_lower
        })

    } catch (e) {
        console.log(`HEROES PROFILE ERROR- ${e}`)
        console.log(e.response.data)
    }



}

async function parseTeam(team) {



    let player_ranks_promises = _.map(team.teamDetails, async (player) => {

        if ( player.displayName.startsWith('DeltaSniper')
            || player.displayName.startsWith('Papertankz')
            || player.displayName.startsWith('Azuriel')
            || player.displayName.startsWith('Crispy')
        ) {
            console.log(player)

        }


        let latest = _.last(player.verifiedRankHistory)
        // console.log(player.verifiedRankHistory)
        // let last_3 
        let sl_rank_max = _.maxBy(player.verifiedRankHistory.slice(-3), 'level')
        // let mmr_max = _.max(player.verifiedRankHistory, 'heroesProfileMmr')

        // let levels = _.map(player.verifiedRankHistory, 'level')
        // console.log(player.displayName)
        // console.log(sl_rank_max)
        // // console.log(mmr_max)
        // console.log(_.map(player.verifiedRankHistory, 'level'))

        await smurfDetectPlayer(player, team)
        if (!latest) {
            console.log(`no verified history for player: ${player.displayName} on team: ${team.teamName}`)
            return {
                name: player.displayName,
                rank: 'UR',
                level: 0,
                heroesProfileMmr: player.heroesProfileMmr
            }
        }
        if (!player['heroesProfileMmr']) {
            console.log(`no MMR for player: ${player.displayName} team: ${team.teamName_lower}`)
        }

        if (sl_rank_max.hlRankMetal.charAt(0) == "U") {
            unranked.push({
                name: player.displayName,
                division: sl_rank_max.hlRankDivision,
                max: sl_rank_max.hlRankMetal,
                rank: sl_rank_max.hlRankMetal.startsWith("Grand") ? "GM" : `${sl_rank_max.hlRankMetal.charAt(0)}${sl_rank_max.hlRankDivision}`,
                level: sl_rank_max.level,
                heroesProfileMmr: player.heroesProfileMmr,
                team: team.teamName_lower,
                win_rate: player.win_rate
            })
        }

        return {
            name: player.displayName,
            rank: sl_rank_max.hlRankMetal.startsWith("Grand") ? "GM" : `${sl_rank_max.hlRankMetal.charAt(0)}${sl_rank_max.hlRankDivision}`,
            level: sl_rank_max.level,
            heroesProfileMmr: player.heroesProfileMmr
        }
    })
    const player_ranks = await Promise.all(player_ranks_promises)



    // console.log(team.teamName_lower)
    // console.log(player_ranks)
    // console.log(_.map(player_ranks, 'heroesProfileMmr'))
    // console.log(_.chain(player_ranks).sortBy('heroesProfileMmr').reverse().slice(0, 4).meanBy('heroesProfileMmr').value())

    let avg_mmr_top_four = _.chain(player_ranks).sortBy('heroesProfileMmr').reverse().slice(0, 4).meanBy('heroesProfileMmr').value()
    let avg_rank_top_four = _.chain(player_ranks).sortBy('level').reverse().slice(0, 4).meanBy('level').value()
    let ranks = _.chain(player_ranks).sortBy('level').reverse().map('rank').value()
    let all_ranks = _.chain(player_ranks).sortBy('level').reverse().map('rank').join(', ').value()
    let all_mmr = _.chain(player_ranks).sortBy('heroesProfileMmr').reverse().map('heroesProfileMmr').join(', ').value()
    let all_level = _.chain(player_ranks).sortBy('level').reverse().map('level').join(', ').value()

    let captain_discord = _.find(team.teamDetails, ['displayName', team.captain])
    // console.log(team.captain)
    // console.log(team.teamDetails)

    let mmr_score = _.chain(player_ranks).sortBy('heroesProfileMmr').reverse().slice(0, 4).sum().value()

    let last_season_div = _.get(team, `season_${last_season}_div`, 'new team')
    let deviation
    if (last_season_div != 'new team') {

        // console.log(Object.keys(last_season_spread))
        let spread = last_season_spread[last_season_div]
        // console.log(last_season_div)

        // console.log(spread)
        deviation = (team.points - spread.mean) / spread.stdev
    }



    return {
        team: team.teamName,
        teamName_lower: team.teamName_lower,
        captain: captain_discord['discordTag'],
        last_season: team.questionnaire.lastSeason,
        old_team: team.questionnaire.oldTeam,
        old_division: team.questionnaire.oldDivision,
        returningPlayers: team.questionnaire.returningPlayers,
        returningPlayersDiv: team.questionnaire.returningPlayersDiv,
        newPlayers: team.questionnaire.newPlayers,
        compLevel: team.questionnaire.compLevel,
        divisionPlacement: team.questionnaire.divisionPlacement,
        priorPlacement: team.questionnaire.priorPlacement,
        otherLeagues: team.questionnaire.otherLeagues,
        otherInfo: team.questionnaire.otherInfo,
        coast: team.questionnaire.eastWest,
        player_count: team.teamDetails.length,
        avg_rank_top_four: avg_rank_top_four,
        rank_1: ranks[0],
        rank_2: ranks[1],
        rank_3: ranks[2],
        rank_4: ranks[3],
        rank_5: ranks[4],
        all_ranks: all_ranks,
        avg_mmr_top_four: avg_mmr_top_four,
        max_mmr: ' ',//_.maxBy(team.teamDetails, 'heroesProfileMmr').heroesProfileMmr,
        mean_mmr: ' ',//_.meanBy(team.teamDetails, 'heroesProfileMmr'),
        min_mmr: ' ',//_.minBy(team.teamDetails, 'heroesProfileMmr').heroesProfileMmr,
        all_mmr: all_mmr,
        all_level: all_level,
        season_11_div: last_season_div,
        wins: _.get(team, 'wins', ''),
        losses: _.get(team, 'losses', ''),
        points: _.get(team, 'points', ''),
        dominations: _.get(team, 'dominations', ''),
        matchesPlayed: _.get(team, 'matchesPlayed', ''),
        deviation: deviation,
        player_info: player_ranks,
        returningPlayers: team.questionnaire.returningPlayers,
        returningPlayersDiv: team.questionnaire.returningPlayersDiv,
        newPlayers: team.questionnaire.newPlayers,
        teamChanges: team.questionnaire.teamChanges
    }
}



function rwa(jsonl) {
    let l = 0
    let vals = _.map(jsonl, (p) => {
        if (l == 0) {
            l = Object.values(p).length
        } else {
            if (Object.values(p).length != l) {
                console.log(`${l} != ${Object.values(p).length} row is the wrong length: ${Object.values(p)}`)
            }
        }

        return Object.values(p)
    })
    // console.log(vals.slice(0,4))

    let m = new Matrix(vals)
    let m_c = correlation(m)

    let r2 = squareMatrix(m_c.toJSON())


    function squareMatrix(m) {
        for (let r = 0; r < m.length; r++) {
            let row = m[r]

            for (let c = 0; c < row.length; c++) {
                let cell = row[c]
                row[c] = cell * cell
                if (r == c) {
                    row[c] = 1
                }
            }
        }
        return m
    }
    const s = new Matrix(r2)
    console.log(m_c.isSymmetric())

    console.log(s.isSymmetric())

    const jrwAnalysis = require('johnsons-relative-weights');

    // console.log(m_c.toJSON())

    const jrwResults = jrwAnalysis(
        m_c.toJSON(),
        1
    );

    let variables = Object.keys(jsonl[0])
    let weights = []
    console.log(`variable, weight`)

    for (let v = 1; v < variables.length - 1; v++) {
        let variable = variables[v]
        let weight = jrwResults.rescaledRawRelativeWeights[v]
        console.log(`${variable}, ${weight}`)
    }
}