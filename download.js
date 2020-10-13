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

const yargs = require('yargs')
.demand('division')
.option('data', {
    alias: 'd',
    type: 'array',
    description: 'Files to load'
})
.argv


const division = JSON.parse(fs.readFileSync(yargs.division, 'utf8'));
async function start() {
    for (let i = 0; i < division.length; i++) {
        let game_id = division[i]
        if (!yargs.d || ! _.find(yargs.d, (file) => {
            return file.endsWith(game_id)
        })) {
            console.log(`DOWNLOADING: ${game_id}`)

            api.get(`/NGS/Replay/Data?replayID=${game_id}`)
            .then((response) => {
                let data = response.data
                storeData(data, `./data/${game_id}`)
        
            }).catch(console.error)
        } else {
            console.log(`game id already downloaded: ${game_id}`)
        }
    }    
}
start().catch(console.error)




