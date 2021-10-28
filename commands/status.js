/**
 * Created by highlander on 5/30/17.
 */

let Redis = require('then-redis')
const config = require('../config')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

// modules
const settings = require('./../modules/settings.js')
const pending = require('./../modules/pending.js')
const coins = require('./../modules/coins.js')

const TAG = ' | status | '

module.exports = {
    lookupTxid: async function (coin, txid) {
        try {
            let blockchainInfo = await coins.getTransaction(txid, coin)

            return blockchainInfo
        } catch (e) {
            console.error(tag, 'e: ', e)
        }
    },

    //
    broken: function () {
        return get_broken_paths()
    },

    removeBroken: function (path) {
        return redBack.srem('brokenPaths', path)
    },

    clearBroken: function () {
        return redBack.del('brokenPaths')
    },

    //
    unconfigured: function () {
        return get_unconfigured_coins()
    },

    percentagesByCoin: function () {
        return percentages_by_coin_view()
    },

    irregularities: function () {
        return get_irregular_balances()
    }
}

const get_unconfigured_coins = async function () {
    const tag = TAG + ' | percentages_by_coin | '
    const debug = true
    try {
        let output = []
        let coins = await settings.coins()

        for (let i = 0; i < coins.length; i++) {
            let coin = coins[i]
            // get rules for each
            let rules = await redBack.hgetall('rules:percentage:' + coin)
            if (debug) console.log(tag, 'rules: ', rules)
            // if no rules add
            if (!rules) output.push(coin)
        }

        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const get_broken_paths = async function () {
    const tag = TAG + ' | percentages_by_coin | '
    const debug = true
    try {
        let paths = await redBack.smembers('brokenPaths')

        let output = []
        for (let i = 0; i < paths.length; i++) {
            let path = paths[i]
            path = path.split('_')
            let view
            if (path[1] === 'hot') {
                view = ':' + path[0] + ': :' + path[1] + ': :arrow_forward: :' + path[2] + ': '
                output.push(view)
            }
        }

        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const percentages_by_coin_view = async function () {
    const tag = TAG + ' | percentages_by_coin | '
    const debug = true
    try {
        const percentagesByCoin = await settings.percentagesByCoin()
        if (debug) console.log('percentagesByCoin: ', percentagesByCoin)
        // get targets

        const coins = Object.keys(percentagesByCoin)
        for (let i = 0; i < coins.length; i++) {
            const coin = coins[i]
            const rules = await redBack.hgetall('rules:percentage:' + coin)
            if (rules) {
                let accounts = Object.keys(rules)
                for (let j = 0; j < accounts.length; j++) {
                    let account = accounts[j]
                    percentagesByCoin[coin][account] = 'a: ' + percentagesByCoin[coin][account] + '          t:' + rules[account]
                }
            }
        }

        return percentagesByCoin
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const get_irregular_balances = async function () {
    const tag = TAG + ' | get_irregular_balances | '
    const debug = false
    try {
        // get balances object from redis
        const balances = await balances.position()
        if (!balances) throw Error('101: Failed to get balances: ')
        if (debug) console.log(tag, 'balances: ', balances)

        const analysis = await analyzer.analyze(balances)
        if (!analysis) throw Error('102: analysis empty')
        if (debug) console.log(tag, 'analysis: ', analysis)

        // display irregularities
        display_irregularities(analysis)
        return true
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}
