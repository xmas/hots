'use strict'
require('colors');
require('dotenv').config();

const _ = require('lodash');
const ObjectsToCsv = require('objects-to-csv');


const fs = require('fs');
const storeData = (data, path) => {
    try {
        fs.writeFileSync(path, JSON.stringify(data))
    } catch (err) {
        console.error(err)
    }
}

let games = {}

function start() {
    loadGames()
   


    let teamGames = _.map(games, (game, id) => {     
        
        if  (game.team_0 !== yargs.team && game.team_1 !== yargs.team) {
            return null
        }

        let team_num = game.team_0 === yargs.team ? 0 : 1
        let heroes = _.map(game, (item, key) => {
            if (typeof item === "object" && item.team === team_num) {
                item['player'] = key
                // console.log(`${id} player ${key} on team: ${team_num}`)
                return item
            }
            return null

        })
        heroes =  _.filter(heroes)
        game['heroes'] = heroes
        game['id'] = id
        return game
    })
    teamGames = _.filter(teamGames)

    // console.log(teamGames)


    let players = _.flatMap(teamGames, (game) => {

        let opp_num = game.team_0 === yargs.team ? 'team_1' : 'team_0'
        let opp = game[opp_num]
        console.log(`Opponent: ${opp}`)

        return _.map(game.heroes, (hero) => {
            return {
                id: game.id,
                player: hero.player,
                hero: hero.hero,
                game_map: game.game_map,
                opponent: opp,
                win: hero.winner ? "WIN" : "LOSS",
                "level": hero.scores.level,
                "kills": hero.scores.kills,
                "assists": hero.scores.assists,
                "takedowns": hero.scores.takedowns,
                "deaths": hero.scores.deaths,
                "highest_kill_streak": hero.scores.highest_kill_streak,
                "hero_damage": hero.scores.hero_damage,
                "siege_damage": hero.scores.siege_damage,
                "structure_damage": hero.scores.structure_damage,
                "minion_damage": hero.scores.minion_damage,
                "creep_damage": hero.scores.creep_damage,
                "summon_damage": hero.scores.summon_damage,
                "time_cc_enemy_heroes": hero.scores.time_cc_enemy_heroes,
                "healing": hero.scores.healing,
                "self_healing": hero.scores.self_healing,
                "damage_taken": hero.scores.damage_taken,
                "experience_contribution": hero.scores.experience_contribution,
                "town_kills": hero.scores.town_kills,
                "time_spent_dead": hero.scores.time_spent_dead,
                "merc_camp_captures": hero.scores.merc_camp_captures,
                "watch_tower_captures": hero.scores.watch_tower_captures,
                "meta_experience": hero.scores.meta_experience,
                "protection_allies": hero.scores.protection_allies,
                "silencing_enemies": hero.scores.silencing_enemies,
                "rooting_enemies": hero.scores.rooting_enemies,
                "stunning_enemies": hero.scores.rooting_enemies,
                "clutch_heals": hero.scores.clutch_heals,
                "escapes": hero.scores.escapes,
                "vengeance": hero.scores.vengeance,
                "outnumbered_deaths": hero.scores.outnumbered_deaths,
                "teamfight_escapes": hero.scores.teamfight_escapes,
                "teamfight_healing": hero.scores.teamfight_healing,
                "teamfight_damage_taken": hero.scores.teamfight_damage_taken,
                "teamfight_hero_damage": hero.scores.teamfight_hero_damage,
                "multikill": hero.scores.multikill,
                "physical_damage": hero.scores.physical_damage,
                "spell_damage": hero.scores.spell_damage,
                "regen_globes": hero.scores.regen_globes,
                "first_to_ten": hero.scores.first_to_ten
            }
        })

    })
    // console.log(players)

    new ObjectsToCsv(players).toDisk(`${yargs.team}.csv`);

    

}

const yargs = require('yargs')
    .option('data', {
        alias: 'd',
        type: 'array',
        description: 'Files to load'
    }).argv

try {
    start()
    
} catch (e) {
    console.error(e)
}

function loadGames() {
    for (let i = 0; i < yargs.d.length; i++) {
        let game = yargs.d[i]
        let data = JSON.parse(fs.readFileSync(game, 'utf8'))
        let id = Object.keys(data)[0]
        games[id] = data[id]
    }
}
