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

const hp_base = 'https://api.heroesprofile.com/api'
axios.defaults.params = {};
const hp_api = axios.create({
    baseURL: hp_base
})
hp_api.interceptors.request.use((config) => {
    config.params = config.params || {};
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


let s11 = JSON.parse(fs.readFileSync('ngs_s11_results.json', 'utf8'))

const player_level_file = "ngs_player_level_cache.jsonl"
const player_detail_file = "ngs_player_detail_cache.jsonl"
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
        let  = []

        const client = await MongoClient.connect(
            'mongodb+srv://neoneROprod:f88IfzGEopyW6VXi@cluster1.tumzk.mongodb.net/myFirstDatabase?authSource=admin&replicaSet=atlas-8v96lc-shard-0&w=majority&readPreference=primary&appname=MongoDB%20Compass&retryWrites=true&ssl=true',
            { useNewUrlParser: true, useUnifiedTopology: true })

        const raw_teams = await client.db(db_name).collection('teams').aggregate(agg).toArray()
        client.close();

        for (let i = 0; i < raw_teams.length; i++) {
            const raw_team = raw_teams[i]
            const team_data = await processTeam(raw_team)
            teams.push(team_data)

        }
        console.log(`Currently there are ${teams.length} teams registered`)
        new ObjectsToCsv(teams).toDisk(`ngs_teams.csv`);
        console.log(raw_teams)
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
    const s11_data = s11[team.teamName]
    // console.log(s11_data)
    Object.assign(team, s11_data)

    const team_data = await parseTeam(team)
    console.log('data added to teams list')
    return team_data
}

async function smurfDetectPlayer(player, team_name) {
    let level
    try {
        let result = player_levels[player.displayName]
        if (!result) {
            result = await hp_api.get(`/Player?battletag=${encodeURIComponent(player.displayName)}&region=1`)
            fs.appendFile(player_level_file, JSON.stringify(result.data) + "\n", function (err) {
                if (err) return console.log(err);

            });
        }
        level = result.account_level
    } catch (e) {
        console.log(e)
    }

    if (level > 300) {
        // console.log(`HIGH LEVEL ${player.displayName} level: ${level}`)
        return
    } else {
        // console.log(`${player.displayName} level: ${level}`)

    }

    try {
        let result = player_details[player.displayName]
        if (!result) {
            console.log(`no player details for ${player.displayName} level: ${level}`)
            result = await hp_api.get(`/Player/Hero/All?battletag=${encodeURIComponent(player.displayName)}&region=1&game_type=${encodeURIComponent("Storm League")}`)
            result = result.data
            result['battletag'] = player.displayName
            fs.appendFile(player_detail_file, JSON.stringify(result) + "\n", function (err) {
                if (err) return console.log(err);

            });
        }
        // console.log(result)
        let storm = result["Storm League"]
        // console.log(_.keys(storm))
        let win_rate = _.chain(storm).map("win_rate").mean().value()

        // console.log(team_name)
        console.log(`${player.displayName} level: ${level} win_rate: ${win_rate} team: ${team_name.teamName_lower}`)
    } catch (e) {
        console.log(e)
    }



}

async function parseTeam(team) {

    let player_ranks_promises = _.map(team.teamDetails, async (player) => {
        let latest = _.last(player.verifiedRankHistory)
        let levels = _.map(player.verifiedRankHistory, 'level')

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

        return {
            name: player.displayName,
            rank: latest.hlRankMetal.startsWith("Grand") ? "GM" : `${latest.hlRankMetal.charAt(0)}${latest.hlRankDivision}`,
            level: latest.level,
            heroesProfileMmr: player.heroesProfileMmr
        }
    })
    const player_ranks = await Promise.all(player_ranks_promises)

    console.log(team.teamName_lower)
    // console.log(player_ranks)
    // console.log(_.map(player_ranks, 'heroesProfileMmr'))
    console.log(_.chain(player_ranks).sortBy('heroesProfileMmr').reverse().slice(0, 4).meanBy('heroesProfileMmr').value())

    let avg_mmr_top_four = _.chain(player_ranks).sortBy('heroesProfileMmr').reverse().slice(0, 4).meanBy('heroesProfileMmr').value()
    let avg_rank_top_four = _.chain(player_ranks).sortBy('level').reverse().slice(0, 4).meanBy('level').value()
    let ranks = _.chain(player_ranks).sortBy('level').reverse().map('rank').value()
    let all_ranks = _.chain(player_ranks).sortBy('level').reverse().map('rank').join(', ').value()
    let all_mmr = _.chain(player_ranks).sortBy('heroesProfileMmr').reverse().map('heroesProfileMmr').join(', ').value()

    return {
        team: team.teamName,
        captain: team.captain,
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
        max_mmr: _.maxBy(team.teamDetails, 'heroesProfileMmr').heroesProfileMmr,
        mean_mmr: _.meanBy(team.teamDetails, 'heroesProfileMmr'),
        min_mmr: _.minBy(team.teamDetails, 'heroesProfileMmr').heroesProfileMmr,
        all_mmr: all_mmr,
        season_11_div: _.get(team, 'season_11_div', 'new team'),
        wins: _.get(team, 'wins', ''),
        losses: _.get(team, 'losses', ''),
        points: _.get(team, 'points', ''),
        dominations: _.get(team, 'dominations', ''),
        matchesPlayed: _.get(team, 'matchesPlayed', ''),
    }
}
