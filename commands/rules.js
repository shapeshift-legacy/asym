/**
 * Created by highlander on 5/30/17.
 */

const config = require('../config')
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const yubikey = require('./../modules/yubikey.js')
const balances = require('./../modules/balances.js')

module.exports = {
    setPercentage: async function (coin, account, percent, auth) {
        var output = await yubikey.authenticate(auth)
        if (output.success) {
            coin = coin.toLowerCase()
            if (account === 'poloniex' || account === 'bittrex' || account === 'hot' || account === 'bitfinex' || account === 'btce' || account === 'kraken' || account === 'binance' || account === 'tagomi') {
                // get all percentages

                // if total + new > 100 throw

                return redBack.hset('rules:percentage:' + coin, account, percent)
            } else {
                return 'Invalid account bro!'
            }
        } else {
            var outputFinal = {
                success: false,
                msg: output.msg,
            }
            return outputFinal
        }
    },
    rules: async function (coin) {
        coin = coin.toLowerCase()
        let output = await redBack.hgetall('rules:percentage:' + coin)
        if (!output) output = { error: 'no rules for coin!', coin }

        // TODO check they add up to 100pct
        let rules = Object.keys(output)
        let total = 0
        for (let i = 0; i < rules.length; i++) {
            let amount = output[rules[i]]
            amount = parseInt(amount)
            total = total + amount
        }
        output.total = total
        return output
    },
    getAlert: async function (coin) {
        let output = await redBack.get('rules:alert:' + coin)
        if (!output) output = 'Not Set'
        return output
    },
    setAlert: async function (coin, amount) {
        let output = await redBack.set('rules:alert:' + coin, amount)
        if (!output) output = true
        return output
    },
    getMin: async function (coin) {
        let output = await redBack.get('rules:minSend:' + coin)
        if (!output) output = 'Not Set'
        return output
    },
    setMin: async function (coin, amount) {
        let output = await redBack.set('rules:minSend:' + coin, amount)
        if (!output) output = true
        return output
    },
    getLoans: async function (exchange) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken' || exchange === 'binance' || exchange === 'tagomi') {
            let output = await redBack.hgetall(exchange + ':loans')
            if (!output) output = 'No loans set!'
            return output
        } else {
            return 'unknown exchange: ' + exchange
        }
    },
    getLoan: async function (coin, exchange) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken' || exchange === 'binance' || exchange === 'tagomi') {
            coin = coin.toUpperCase()
            let output = redBack.hget(exchange + ':loans', coin)
            if (!output) output = 'No loans set!'
            return output
        } else {
            return 'unknown exchange: ' + exchange
        }
    },
    setLoan: async function (exchange, coin, amount) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken' || exchange === 'binance' || exchange === 'tagomi') {
            coin = coin.toUpperCase()
            return redBack.hset(exchange + ':loans', coin, amount)
        } else {
            return 'unknown exchange: ' + exchange
        }
    },
    getMax: async function (coin) {
        let output = await redBack.get('rules:maxSend:' + coin)
        if (!output) output = 'Not Set'
        return output
    },
    setMax: async function (coin, amount) {
        let output = await redBack.set('rules:maxSend:' + coin, amount)
        if (!output) output = true
        return output
    },
    getMaxBitfinex: async function (coin) {
        coin = coin.toUpperCase()
        let output = await redBack.get('rules:maxSend:bitfinex:' + coin)
        if (!output) output = 'Not Set'
        return output
    },
    setMaxBitfinex: async function (coin, amount) {
        coin = coin.toUpperCase()
        let output = await redBack.set('rules:maxSend:bitfinex:' + coin, amount)

        if (!output) output = true
        return output
    },
    target: function (coin) {
        let output = {}
        coin = coin.toUpperCase()
        return redBack.hgetall('rules:' + coin)
    },
    targetActual: async function (coin) {
        coin = coin.toUpperCase()
        let targets = await redBack.hgetall('rules:' + coin)

        // adjust
        targets.kraken_max = parseInt(targets.kraken_max) + 200
        targets.kraken_min = parseInt(targets.kraken_min) + 200

        targets.Bitfinex_min = parseInt(targets.Bitfinex_min) + 200
        targets.Bitfinex_max = parseInt(targets.Bitfinex_max) + 200
        return targets
    },
}
