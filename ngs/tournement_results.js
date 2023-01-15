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


const db_name = process.env.HEROKU_DB_NAME
const this_season = process.env.THIS_SEASON
const last_season = this.this_season - 1

const agg = [
    {
        
    }
];


async function run() {
    try {

        const client = await MongoClient.connect(
            'mongodb+srv://neoneROprod:f88IfzGEopyW6VXi@cluster1.tumzk.mongodb.net/myFirstDatabase?authSource=admin&replicaSet=atlas-8v96lc-shard-0&w=majority&readPreference=primary&appname=MongoDB%20Compass&retryWrites=true&ssl=true',
            { useNewUrlParser: true, useUnifiedTopology: true })

        let raw_teams = await client.db(db_name).collection('matches').aggregate(agg).toArray()

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