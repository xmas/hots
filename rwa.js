'use strict'
require('colors');
require('dotenv').config();

const _ = require('lodash');
const ObjectsToCsv = require('objects-to-csv');

const jrwAnalysis = require('johnsons-relative-weights');
const {
    Matrix,
    correlation
} = require('ml-matrix');


const fs = require('fs');
const storeData = (data, path) => {
    try {
        fs.writeFileSync(path, JSON.stringify(data))
    } catch (err) {
        console.error(err)
    }
}

const yargs = require('yargs')
    .option('data', {
        alias: 'd',
        type: 'array',
        description: 'Files to load'
    }).argv



let games = {}

function start() {
    let players = loadGames()
    // new ObjectsToCsv(players).toDisk(`players.csv`);

    rwa(players)

//     let heroes = _.chain(games).flatMap((g) => {
//         return _.map(g, 'hero')
//     }).filter().uniq().sort().value()

//     let template = {win: 0}
//     for (let i = 0; i < heroes.length; i++) {
//         template[heroes[i]] = 0
//     }
//     let hero_games = _.map(players, (p) => {
//         let val = Object.assign({}, template)
//         val.win = p.win
//         val[p.hero] = 1
//         return val
//     })

//     // console.log(hero_games.slice(0,4))
//    rwa(hero_games)

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


    let teamGames = _.map(games, (game, id) => {

        // if  (game.team_0 !== yargs.team && game.team_1 !== yargs.team) {
        //     return null
        // }

        let team_num = game.team_0 === yargs.team ? 0 : 1
        let heroes = _.map(game, (item, key) => {
            if (typeof item === "object" && item.team === team_num) {
                item['player'] = key
                // console.log(`${id} player ${key} on team: ${team_num}`)
                return item
            }
            return null

        })
        heroes = _.filter(heroes)
        game['heroes'] = heroes
        game['id'] = id
        return game
    })
    teamGames = _.filter(teamGames)

    return _.flatMap(teamGames, (game) => {

        let opp_num = game.team_0 === yargs.team ? 'team_1' : 'team_0'
        let opp = game[opp_num]

        return _.map(game.heroes, (hero) => {
            return {
                // id: game.id,
                // player: hero.player,
                // hero: hero.hero,
                // game_map: game.game_map,
                // opponent: opp,
                win: hero.winner ? 1 : 0,
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
                "regen_globes": hero.scores.regen_globes
            }
        })

    })




}



const proceedJohnsonReletiveWeightsAlgorithm = function (correlationMatrix, dependentVariable) {

    // Step 1. Compute correlation matrix between independent variables   
    const rxy = computeCorrelationMatrixBetweenDependentVariables(correlationMatrix, dependentVariable);
    let correlationMatrixBetweenIndependentVariables = computeCorrelationMatrixBetweenIndependentVariables(correlationMatrix, dependentVariable);

    // Step 2. Calculate EigenVector and EigenValues based on correlation matrix
    const evd = new EVD(new Matrix(correlationMatrixBetweenIndependentVariables));
    const eigenVectorsMatrix = extractMatrix(evd.eigenvectorMatrix, 'eigen-vectors-matrix');
    const eigenValues = createDiagonalMatrixOfEigenValues(evd.realEigenvalues.reverse());

    // Step 3. Calculate diagonal matrix of eigenvalue and then take square root of the diagonal matrix
    const squareRootDiagonalEVMatrix = sqrt(eigenValues);

    // Step 4. Calculate matrix multiplication of eigenvector, matrix in step 3 and Transpose of Eigenvector
    const evMatrixTransposed = extractMatrix(new Matrix(eigenVectorsMatrix), 'matrix-transposed');
    const lambda = extractMatrix(new Matrix(eigenVectorsMatrix).mmul(new Matrix(squareRootDiagonalEVMatrix)).mmul(new Matrix(evMatrixTransposed)), 'matrix-transposed');

    // Step 5. Square matrix in step 4.
    const lambdaSquared = square(lambda);

    // Step 6 To calculate the partial effect of each independent variable on dependent variable, calculate matrix multiplication of 
    // [Inverse of matrix in step 4] and correlation matrix [between dependent and independent variables (i.e. 1 X 1 matrix)]
    const lambdaInversed = extractMatrix(inverse(lambda), 'matrix-transposed');

    // RXY multiplicated with inverse matrix
    const partialEffect = extractMatrix(new Matrix(lambdaInversed).mmul(new Matrix(rxy)));

    // Step 7. To calculate R-Square, sum the above matrix (Step 6 matrix)
    const rSquared = calculateRSquared(partialEffect);

    // Step 8. To calculate raw relative weights, calculate matrix multiplication of [matrix in step 5] and [Square of matrix in step 6]
    // Square of step 6 matrix 
    const partialEffectSquared = square(partialEffect);

    // Square of step 6 matrix X matrix in step 5
    const rawRelativeWeights = [].concat.apply([], extractMatrix(new Matrix(lambdaSquared).mmul(new Matrix(partialEffectSquared))));

    // Step 9. To calculate raw relative weights as percentage of R-Square, divide raw relative weights by r-square and then multiply it by 100.
    const rescaledRawRelativeWeights = rawRelativeWeights.map(value => value / rSquared * 100);

    return { rawRelativeWeights, rescaledRawRelativeWeights };
}
