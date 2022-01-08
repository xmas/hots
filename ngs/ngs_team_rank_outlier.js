const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const _ = require('lodash')
// require('lodash-math')(_);


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

const jrwAnalysis = require('johnsons-relative-weights');
const {
    Matrix,
    correlation
} = require('ml-matrix');


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

const last_season = 12
let last_season_ranks = JSON.parse(fs.readFileSync(`ngs_archive/ngs_s${last_season}_results.json`, 'utf8'))

const player_level_file = "ngs_archive/ngs_player_level_cache.jsonl"
const player_detail_file = "ngs_archive/ngs_player_detail_cache.jsonl"
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
        

        mmrToRank(teams)
        

    } catch (e) {
        console.log(e)
    }

}
run().catch(console.dir);
function standardDeviation(values){
    var avg = average(values);
    
    var squareDiffs = values.map(function(value){
      var diff = value - avg;
      var sqrDiff = diff * diff;
      return sqrDiff;
    });
    
    var avgSquareDiff = average(squareDiffs);
  
    var stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
  }
  
  function average(data){
    var sum = data.reduce(function(sum, value){
      return sum + value;
    }, 0);
  
    var avg = sum / data.length;
    return avg;
  }

function mmrToRank(teams) {
    let players = _.flatMap(teams, 'players')
    let ranks = _.chain(players)
    .groupBy( (player) => {
        if (player.rank.startsWith("M")) {
            return "M"
        } 
        return player.rank
    })
    .map( (rank, rank_name) => {
        let stats =  {
            name: rank_name,
            count: rank.length,
            level: _.minBy(rank, 'heroesProfileMmr').level,
            mmr_min: _.minBy(rank, 'heroesProfileMmr')['heroesProfileMmr'],
            mmr_mean: _.meanBy(rank, 'heroesProfileMmr'),
            mmr_max: _.maxBy(rank, 'heroesProfileMmr')['heroesProfileMmr'],
            stdev: standardDeviation(_.map(rank, 'heroesProfileMmr'))
        }
        let sigma = 2.5
        let outliers = _.filter(rank, (player) => {
            return player.heroesProfileMmr > stats.mmr_mean+2.5*stats.stdev //|| player.heroesProfileMmr < stats.mmr_mean-2.5*stats.stdev
        })
        stats['outliers'] = _.map(outliers, (player) => {
            return `${player.name} - ${player.heroesProfileMmr}`
        })
        return stats
    })
    .sortBy('mmr_mean')
    .value()
    new ObjectsToCsv(ranks).toDisk(`ranks.csv`);

    console.log(ranks)
}

function sortTeams(teams) {
    // new ObjectsToCsv(teams).toDisk(`ngs_teams.csv`);
        // console.log(raw_teams)

        let sorted_teams = _.chain(teams)
        .sortBy( (team) => {
            return team.metal_top_four
        })
        .reverse()
        .map( (team) => {

            return {
                team: team.team,
                season_11_div: team.season_11_div,
                coast: team.coast,
                metal_top_four: team.metal_top_four,
                metal_1: team.metal_1,
                all_ranks: team.all_ranks,
                all_mmr: team.all_mmr,

                divisionPlacement: team.divisionPlacement,
                
            }
        }).value()

        console.log(sorted_teams.length)
        let storm = sorted_teams.slice(0,6)
        sorted_teams = sorted_teams.slice(6)
        let east = _.filter(sorted_teams, ['coast', 'east'])
        let west = _.filter(sorted_teams, ['coast', 'west'])
        let either = _.filter(sorted_teams, (team) => {
            return team.coast != 'west'&& team.coast != 'east'
        })
        console.log(_.map(storm, 'team'))
        console.log(`${storm[storm.length-1].team} east ${east[0].team} west ${west[0].team}`)
        console.log(`storm: ${storm.length} east ${east.length} west ${west.length} either ${either.length}`)
        new ObjectsToCsv(sorted_teams).toDisk(`sorted_teams.csv`);
}

async function processTeam(team) {
    if (!team) {
        console.log(`UNDEFINED TEAM FOUND`)
        console.log(team)
        process.exit()
    }
    const last_season_ranks_data = last_season_ranks[team.teamName]
    // console.log(last_season_ranks_data)
    Object.assign(team, last_season_ranks_data)

    const team_data = await parseTeam(team)
    // console.log('data added to teams list')
    return team_data
}

async function smurfDetectPlayer(player, team) {
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
    // console.log('BUG IN LEVELS>>>>>')
    // return
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
        // _.set(team['potentialSmurfs'],  
        console.log(`${player.displayName} level: ${level} win_rate: ${win_rate} team: ${team.teamName_lower}`)
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

        let rank = latest.hlRankMetal.startsWith("Grand") ? "GM" : `${latest.hlRankMetal.charAt(0)}${latest.hlRankDivision}`
        let metal = latest.level
        if (rank === "GM") {
            metal = 10000
        } else if (rank.startsWith("M")) {
            metal = 5000
        } else if (rank.startsWith("D")) {
            metal = 3000 + latest.level
        } else if (rank.startsWith("P")) {
            metal = 2000 + latest.level
        } else if (rank.startsWith("G")) {
            metal = 1000 + latest.level
        } else if (rank.startsWith("S")) {
            metal = 1000 + latest.level
        } else {
            metal = 100 + latest.level
            //bronze
        }

        return {
            name: player.displayName,
            rank: rank,
            level: latest.level,
            metal: metal,
            // metal: 27-latest.level * 1000,
            heroesProfileMmr: player.heroesProfileMmr
        }
    })
    const player_ranks = await Promise.all(player_ranks_promises)

    // assign unranked players to the same level as the highest rank
    // let max_player = _.chain(player_ranks).sortBy('level').reverse().value()[0]
    // for (let i = 0; i < player_ranks.length; i++) {
    //     let p = player_ranks[i]
    //     if (p.rank.startsWith("U")) {
    //         // console.log(`unranked player: ${p.rank} assigned to ${max_player.rank}`)
    //         player_ranks[i] = _.clone(max_player)
    //         // console.log(p.metal)
    //     }
    // }
    // console.log(_.map(player_ranks, 'rank'))


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
    let level_score = _.chain(player_ranks).sortBy('metal').reverse().slice(0, 4).sum().value()
    let metals = _.chain(player_ranks).sortBy('metal').reverse().map('metal').value()
    let metal_top_four = _.chain(player_ranks).sortBy('metal').reverse().slice(0, 4).meanBy('metal').value()


    return {
        team: team.teamName,
        players: player_ranks,
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
        metal_1: metals[0],
        metal_2: metals[1],
        metal_3: metals[2],
        metal_4: metals[3],
        metal_5: metals[4],
        metal_top_four: metal_top_four,
        all_ranks: all_ranks,
        avg_mmr_top_four: avg_mmr_top_four,
        max_mmr: _.maxBy(team.teamDetails, 'heroesProfileMmr').heroesProfileMmr,
        mean_mmr: _.meanBy(team.teamDetails, 'heroesProfileMmr'),
        min_mmr: _.minBy(team.teamDetails, 'heroesProfileMmr').heroesProfileMmr,
        all_mmr: all_mmr,
        all_level: all_level,
        season_11_div: _.get(team, 'season_11_div', 'new team'),
        wins: _.get(team, 'wins', ''),
        losses: _.get(team, 'losses', ''),
        points: _.get(team, 'points', ''),
        dominations: _.get(team, 'dominations', ''),
        matchesPlayed: _.get(team, 'matchesPlayed', ''),
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