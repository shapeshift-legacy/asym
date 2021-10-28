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

const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

module.exports = {

    history: function (exchange, coin) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            return exchanges[exchange].withdrawalHistory(coin)
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    // balances
    balances: function (exchange) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            return exchanges[exchange].balances()
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    // addresses
    addresses: function (exchange) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            return exchanges[exchange].addresses()
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    // addresses
    address: function (exchange, coin) {
        if (coin && exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            coin = coin.toUpperCase()
            return exchanges[exchange].address(coin)
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    // open orders

    // place bid

    bid: function (exchange, pair, rate, amount) {
        if (coin && exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken') {
            coin = coin.toUpperCase()
            return exchanges[exchange].bid(pair, rate, amount)
        } else {
            return 'unknown exchange: ' + exchange
        }
    },

    // place ask

    // cancel order

}
