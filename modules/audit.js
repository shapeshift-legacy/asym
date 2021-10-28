/**
 * Created by highlander on 7/7/17.
 */
/**
 * Created by highlander on 4/19/17.
 */

const config = require('../config')
const Redis = require('promise-redis')()
const redis = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const TAG = ' | audit module | '

// get exchanges
const exchanges = {}
exchanges.kraken = require('./../exchanges/kraken-client.js')
exchanges.bittrex = require('./../exchanges/bittrex-client.js')
exchanges.poloniex = require('./../exchanges/poloniex-client.js')
exchanges.bitfinex = require('./../exchanges/bitfinex-client.js')

// mongo
let monk = require('monk')
const db = monk(config.MONGO_URI)
let dbList = ['tx', 'conduit', 'pendingTx', 'thresholds', 'thresholdTX', 'storageXENG', 'rippleAccounts', 'rippleTx', 'affiliateInfo', 'orders']
let tx = db.get('tx')
let conduit = db.get('conduit')
let pendingTx = db.get('pendingTx')
let thresholds = db.get('thresholds')
let thresholdTx = db.get('thresholdTX')
let storageXENG = db.get('storageXENG')
let rippleAccounts = db.get('rippleAccounts')
let rippleTx = db.get('rippleTx')
let affiliateInfo = db.get('affiliateInfo')
let orders = db.get('orders')
let dbs = { tx, conduit, pendingTx }

/*********************************
 // Modules
 //*********************************/
module.exports = {
    coinBalanceByDays: function (coin, days) {
        return audit_by_days(coin, days)
    },
    coinBalanceTimeframe: function (coin, start, stop) {
        return audit_by_timeframe(coin, start, stop)
    },
}

const audit_by_days = async function (coin, days) {
    const tag = ' | audit_by_days | '
    let debug = true
    try {
        if (coin) coin = coin.toUpperCase()
        if (debug) console.log(tag, 'coin: ', coin)
        if (debug) console.log(tag, 'days: ', days)

        let stop = new Date().getTime()
        let start
        // if no time assume 1 day
        if (!days) {
            start = stop - 1000 * 60 * 60 * 24
        } else {
            start = stop - 1000 * 60 * 60 * 24 * days
        }

        // get exchange data
        start = start / 1000
        start = parseInt(start)

        stop = stop / 1000
        stop = parseInt(stop)

        let results = await audit_by_timeframe(coin, start, stop)

        return results
    } catch (e) {
        console.error(tag, 'e:', e)
        throw 'ERROR:100 Failed to update status! :' + e
    }
}

const audit_by_timeframe = async function (coin, start, stop) {
    // "use strict";
    const tag = ' | audit_by_timeframe | '
    let debug = true
    try {
        coin = coin.toUpperCase()
        // get all orders by outgoing coin in timeframe
        let query = { $and: [{ time: { $gt: start } }, { time: { $lt: stop } }, { currencyOut: coin }] }
        // let query = {currencyOut:coin}
        let results = await tx.find(query)
        // if(debug) console.log(tag,"results: ",results)
        // X coin was sent
        let totalSent = 0
        for (let i = 0; i < results.length; i++) {
            let entry = results[i]
            if (debug) console.log(tag, 'coinToUser: ', entry.coinToUser)

            if (entry.coinToUser) totalSent = totalSent + parseFloat(entry.coinToUser)
        }
        if (debug) console.log(tag, 'totalSent: ', totalSent)

        // get exchanges coin trades on

        // X coin was purchased
        let historyBitfinex = await exchanges.bitfinex.tradeHistory(coin + 'btc', start, stop)
        if (debug) console.log(tag, 'historyBitfinex: ', historyBitfinex.length)
        // expect(history).to.be.an('array')
        historyBitfinex = historyBitfinex.result
        let totalBuyBitfinex = 0
        for (var i = 0; i < historyBitfinex.length; i++) {
            let entry = historyBitfinex[i]
            console.log('amount: ', entry.amount)
            // if buy
            if (entry.type == 'Buy') {
                let amount = parseFloat(entry.amount) / parseFloat(entry.price)
                console.log('amount: ', amount)
                totalBuyBitfinex = totalBuyBitfinex + amount
            }
        }

        //
        let historyPolo = await exchanges.poloniex.tradeHistory('BTC_' + coin.toUpperCase(), start, stop)

        // expect(history).to.be.an('array')
        historyPolo = historyPolo.result
        // if(debug) console.log(tag,"historyPolo: ",historyPolo)

        let totalBuyPolo = 0
        for (var i = 0; i < historyPolo.length; i++) {
            let entry = historyPolo[i]
            console.log('amount: ', entry.total)
            // if buy
            if (entry.type == 'buy') {
                totalBuyPolo = totalBuyPolo + parseFloat(entry.total)
            }
        }

        if (debug) console.log(tag, 'Total To Cutomer: ', totalSent)
        if (debug) console.log(tag, 'Total bought on polo: ', totalBuyPolo)
        if (debug) console.log(tag, 'Total bought on Bitfinex: ', totalBuyBitfinex)
        let totalBought = totalBuyBitfinex + totalBuyPolo
        if (debug) console.log(tag, 'Total bought: ', totalBought)
        if (debug) console.log(tag, 'Total Diff: ', totalSent - totalBought)

        let report = {}
        report.totalSent = totalSent
        report.totalBuyPolo = totalBuyPolo
        report.totalBuyBitfinex = totalBuyBitfinex
        report.totalBought = totalBought
        report.failedToBuy = totalSent - totalBought

        return report
    } catch (e) {
        console.error(e)
        throw Error('Failed to query ' + e)
    }
}
