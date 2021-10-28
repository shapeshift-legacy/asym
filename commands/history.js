/**
 * Created by highlander on 9/20/17.
 */
/**
 * Created by highlander on 8/8/17.
 */
/**
 * Created by highlander on 5/30/17.
 */
const when = require('when')
const fs = require('fs')
const monk = require('monk')
const json2csv = require('json2csv')
const config = require('../config')
const db = monk(config.MONGO_URI)
const balancesH = db.get('asynbalances')
const actionsH = db.get('actions')
const reportsH = db.get('reports')
const SlackUpload = require('node-slack-upload')
const slackUp = new SlackUpload(config.SLACK_CONFIG.token)

const exchanges = {}
exchanges.kraken = require('./../exchanges/kraken-client.js')
exchanges.bittrex = require('./../exchanges/bittrex-client.js')
// exchanges.poloniex = require('./../exchanges/poloniex-client.js')
exchanges.bitfinex = require('./../exchanges/bitfinex-client.js')

let exchangeNames = Object.keys(exchanges)
let dbs = {}
dbs['internalTransactions'] = db.get('internalTransactions')
for (let i = 0; i < exchangeNames.length; i++) {
    let exchange = exchangeNames[i]
    dbs[exchange + 'Trades'] = db.get(exchange + 'Trades')
    // dbs[exchange+"Transfers"] = db.get(exchange+"Transfers");
    // dbs[exchange+"Trades"].ensureIndex({id: 1}, {unique: true})
    // dbs[exchange+"Transfers"].ensureIndex({id: 1}, {unique: true})

    dbs[exchange + 'Withdrawals'] = db.get(exchange + 'Withdrawals')
    dbs[exchange + 'Deposits'] = db.get(exchange + 'Deposits')
    // dbs[exchange+"Trades"].createIndex({id: 1}, {unique: true})     //if mongo version > 3
    // dbs[exchange+"Transfers"].createIndex({id: 1}, {unique: true})  //if mongo version > 3
}

const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

module.exports = {
    // time tools
    dateToTimestamp: function (month, date, year) {
        let input = month + ' ' + date + ' ' + year
        let output = new Date(input).getTime()
        return output
    },

    timestampToDate: function (timestamp) {
        timestamp = parseInt(timestamp)
        let output = new Date(timestamp).toString()
        return output
    },

    countTransfers: async function (start, end) {
        if (start && end) {
            // hit mongo
            let query = {}
            if (coin) query['coin'] = coin.toUpperCase()
            if (!limit) limit = 10
            let options = { limit, sort: { time: -1 } }

            let mongoData = await dbs['internalTransactions'].count(query, options)
            return mongoData
        } else {
            let mongoData = await dbs['internalTransactions'].count()
            return mongoData.toString()
        }
    },

    lastTransfers: async function (exchange, coin, limit) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            // hit mongo
            let query = {}
            if (coin) query['coin'] = coin.toUpperCase()
            if (!limit) limit = 10
            let options = { limit, sort: { time: -1 } }
            let mongoData = await dbs['internalTransactions'].find(query, options)
            return mongoData
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    //
    lastDeposits: async function (exchange, coin, limit) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            // hit mongo
            let query = {}
            if (coin) query['coin'] = coin.toUpperCase()
            if (!limit) limit = 10
            let options = { limit, sort: { time: -1 } }
            // let mongoData = await dbs[exchange+"Deposits"].find(query,options)
            console.log(exchange)
            let mongoData = await dbs[exchange + 'Deposits'].find()
            return mongoData
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    lastWithdrawals: async function (exchange, coin, limit) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            // hit mongo
            let query = {}
            if (coin) query['coin'] = coin.toUpperCase()
            if (!limit) limit = 10
            let options = { limit, sort: { time: -1 } }
            let mongoData = await dbs[exchange + 'Withdrawals'].find(query, options)
            return mongoData
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    // get all incomplete withdrawals
    incompleteWithdrawals: async function (exchange) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            // hit mongo
            let query = {}
            // where txid DNE
            query['txid'] = { $exists: false }
            // let options = {limit,sort: {time: -1}}
            let mongoData = await dbs[exchange + 'Withdrawals'].find(query)
            return mongoData
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    // get all incomplete withdrawals
    erroredWithdrawals: async function (exchange) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            // hit mongo
            let query = {}
            // where txid DNE
            query['status'] = 'COMPLETE: ERROR'
            let mongoData = await dbs[exchange + 'Withdrawals'].find(query)
            if (mongoData.length === 0) mongoData = 'None found!'
            return mongoData
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    // get all incomplete withdrawals
    // incompleteDeposits: async function (exchange,coin)
    // {
    //     if(exchange === "poloniex" || exchange === "bittrex" || exchange === "bitfinex" || exchange === "btce" || exchange === "kraken") {
    //
    //         //hit mongo
    //         let query = {}
    //         if(coin) query['coin'] = coin.toUpperCase()
    //         if(!limit) limit = 10
    //         //where txid DNE
    //         query[txid]= {$exists:false}
    //         let options = {limit,sort: {time: -1}}
    //         let mongoData = await dbs[exchange + "Transfers"].find(query,options)
    //         return mongoData
    //     } else {
    //         return "unknown exchange: "+exchange
    //     }
    //
    // },

    // where status = error

    // total exchange acquisitions

    // total exchange disposals

    // total shapeshift acquisitions

    // total shapeshift disposials

}
