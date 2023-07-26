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


const yargs = require('yargs')
.demand('division')
.option('data', {
    alias: 'd',
    type: 'array',
    description: 'Files to load'
})
.argv

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