'use strict'
require('colors');
require('dotenv').config();

const { get } = require('lodash');
const _ = require('lodash');

const base = 'https://api.heroesprofile.com/api'
const axios = require('axios')
axios.defaults.params = {};
const api = axios.create({
    baseURL: base
})
api.interceptors.request.use((config) => {
    config.params = config.params || {};
    config.params['api_token'] = process.env.HEROES_PROFILE_TOKEN
    return config;
});

const fs = require('fs')
const storeData = (data, path) => {
    try {
        fs.writeFileSync(path, JSON.stringify(data))
    } catch (err) {
        console.error(err)
    }
}

// const yargs = require('yargs')
//     .demand('division')
//     .option('data', {
//         alias: 'd',
//         type: 'array',
//         description: 'Files to load'
//     })
//     .argv

const players = [
    {
        tag: "Neone",
        id: 1749
    }
]
// const division = JSON.parse(fs.readFileSync(yargs.division, 'utf8'));
async function start() {

    for (let player of players) {
        console.log(player)
        // api.get(`/Player/Hero/All?battletag=${players.tag}%${players.id}&region=1&game_type=Storm%20League`)
        api.get(`/Player/Hero/All?battletag=Neone#1749&region=1`)

            .then((response) => {
                // let data = response.data
                // storeData(data, `./data/${game_id}`)
                console.log(response.data)

            }).catch(console.error)
    }

}
start().catch(console.error)



