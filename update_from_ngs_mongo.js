const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const _ = require('lodash')
const ObjectsToCsv = require('objects-to-csv');

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
 

async function run() {
  try {
    let teams = []
    const client = MongoClient.connect(
        'mongodb+srv://neoneROprod:f88IfzGEopyW6VXi@cluster1.tumzk.mongodb.net/myFirstDatabase?authSource=admin&replicaSet=atlas-8v96lc-shard-0&w=majority&readPreference=primary&appname=MongoDB%20Compass&retryWrites=true&ssl=true',
        { useNewUrlParser: true, useUnifiedTopology: true },
        async function(connectErr, client) {
          assert.equal(null, connectErr);
          const coll = client.db(db_name).collection('teams');
          const aggCursor = coll.aggregate(agg)
          await aggCursor.forEach(team => {
            // console.log(team.teamDetails);
            const team_data = parseTeam(team)
            teams.push(team_data)
          });
          console.log(teams)
          new ObjectsToCsv(teams).toDisk(`ngs_teams.csv`);

          client.close();
        });
  } catch (e) {
      console.log(e)
  }
}
run().catch(console.dir);

function parseTeam(team) {
    // _.map(team.teamDetails, (player) => {
    //     console.log(player.displayName)
    //     console.log(player.level)
    //     console.log(player)
    // })

    let player_ranks = _.map(team.teamDetails, (player) => {
        let latest = _.last(player.verifiedRankHistory)
        let levels = _.map(player.verifiedRankHistory, 'level')
        return {
            name: player.displayName,
            rank: `${latest.hlRankMetal.charAt(0)}${latest.hlRankDivision}`,
            level: latest.level,
            heroesProfileMmr: player.heroesProfileMmr
        }
    })
    let avg_mmr_top_four = _.chain(player_ranks).sortBy('heroesProfileMmr').reverse().slice(0,4).meanBy('heroesProfileMmr').value()
    let avg_rank_top_four = _.chain(player_ranks).sortBy('level').reverse().slice(0,4).meanBy('level').value()
    let ranks = _.chain(player_ranks).sortBy('level').reverse().map('rank').value()
    let all_ranks = _.chain(player_ranks).sortBy('level').reverse().map('rank').join(', ').value()
    let all_mmr = _.chain(player_ranks).sortBy('heroesProfileMmr').reverse().map('heroesProfileMmr').join(', ').value()

    return {
        team: team.teamName,
        captain: team.captain,
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
        all_mmr: all_mmr
    }
}
