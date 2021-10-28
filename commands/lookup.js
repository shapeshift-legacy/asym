/**
 * Created by highlander on 6/4/17.
 */
/**
 * Created by highlander on 5/30/17.
 */
const monk = require('monk')
const Redis = require('then-redis')
const config = require('../config')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

// mongo
const db = monk(config.MONGO_URI)

const balancesH = db.get('asynbalances')
const actionsH = db.get('actions')
const reportsH = db.get('reports')

// modules
const settings = require('./../modules/settings.js')
const pending = require('./../modules/pending.js')
const coins = require('./../modules/coins.js')
const views = require('./../modules/views.js')

const exchanges = {}
exchanges.kraken = require('./../exchanges/kraken-client.js')
exchanges.bittrex = require('./../exchanges/bittrex-client.js')
// exchanges.poloniex = require('./../exchanges/poloniex-client.js')
exchanges.bitfinex = require('./../exchanges/bitfinex-client.js')

const TAG = ' | status | '

module.exports = {

    client: async function (coin, txid) {
        let tag = TAG + ' | client | '
        try {
            let blockchainInfo = await coins.getTransaction(txid, coin)

            return blockchainInfo
        } catch (e) {
            console.error(tag, 'e: ', e)
            return e
        }
    },

    deposits: async function (coin, days) {
        let tag = TAG + ' | deposits | '
        try {
            let time = new Date().getTime()
            let timeFrom
            // if no time assume 1 day
            if (!time) {
                timeFrom = time - 1000 * 60 * 60 * 24
            } else {
                timeFrom = time - 1000 * 60 * 60 * time
            }
            let query = { $and: [{ coin: coin }, { time: { $gt: timeFrom } }] }

            //
            const entries = await reportsH.find(query)

            return entries
        } catch (e) {
            console.error(tag, 'e: ', e)
            return e
        }
    },

    exchange: async function (exchange, txid) {
        let tag = TAG + ' | exchange | '
        let debug = true
        let verbose = true
        try {
            // if valid exchange
            if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
                // get history
                let results = await exchanges[exchange].transferHistory()
                if (debug) console.log(tag, 'results: ', results.length)
                if (verbose) console.log(tag, 'results: ', results)
                // search txid
                let txids = []
                let txidIndex = {}
                for (let i = 0; i < results.length; i++) {
                    let result = results[i]
                    if (result.txid) {
                        txids.push(result.txid)
                        txidIndex[result.txid] = i
                    }
                }

                // get ids from exchange
                let ids = []
                let idIndex = {}
                for (let i = 0; i < results.length; i++) {
                    let result = results[i]
                    if (result.id) {
                        ids.push(result.id)
                        idIndex[result.id] = i
                    }
                }
                if (debug) console.log(tag, 'ids: ', ids)
                if (debug) console.log(tag, 'id LOOKUP POSITION: ', ids.indexOf(txid))
                if (debug) console.log(tag, 'txids: ', txids)
                if (debug) console.log(tag, 'txid LOOKUP: ', txid)
                if (debug) console.log(tag, 'txid LOOKUP POSITION: ', txids.indexOf(txid))
                const output = {}
                if (txids.indexOf(txid) >= 0) {
                    output.success = true
                    output.txid = txid
                    const position = txids.indexOf(txid)
                    output.position = position
                    // display the entry
                    views.smartDisplay(results[txidIndex[txid]], 'Entry found!')
                } else {
                    output.success = false
                }

                if (ids.indexOf(txid) >= 0) {
                    output.success = true
                    output.id = txid
                    // const position = results[txidIndex[txid]]
                    // output.position = position
                    // display the entry
                    views.smartDisplay(results[idIndex[txid]], 'Entry found!')

                    let transfer = results[idIndex[txid]]
                    if (debug) console.log(tag, '**** hit: ', transfer)
                    // update status
                } else {
                    output.success = false
                }

                return output
            } else {
                return 'Invalid exchange!'
            }
        } catch (e) {
            console.error(tag, 'e: ', e)
        }
    },

}
