/**
 * Created by highlander on 6/6/17.
 */

const balances = require('./../modules/balances.js')
const views = require('./../modules/views.js')

const randomstring = require('randomstring')
const config = require("../config")
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

module.exports = {
    testTxs: async function (coin, amount) {
        try {
            return build_test_txs(coin, amount)
        } catch (e) {
            console.error(tag, 'e: ', e)
        }
    },
}

const build_test_txs = async function (coin, amount) {
    const tag = ' | run_test | '
    const debug = true
    const debug1 = true
    try {
        coin = coin.toLowerCase()
        if (debug1) console.log(tag, 'coin: ', coin)
        // //get balances
        let position = await balances.byCoin()
        if (debug1) console.log(tag, 'position: ', position)

        console.log(tag, 'coin position: ', position[coin])
        // get possible paths
        let accounts = Object.keys(position[coin])
        if (debug1) console.log(tag, 'accounts: ', accounts)

        let report = {}
        report.actions = {}
        // hot -> exchange
        for (let i = 0; i < accounts.length; i++) {
            let account = accounts[i]
            if (debug) console.log(tag, 'account: ', account)
            if (account != 'hot' && account != 'store') {
                // test pair
                if (debug1) console.log(tag, 'test pair: hot ' + account + ' ' + amount)
                let actionId = randomstring.generate(7)
                report.actions[actionId] = coin + ' ' + amount + ' hot ' + account
            }
        }
        // exchange -> hot
        for (let i = 0; i < accounts.length; i++) {
            let account = accounts[i]
            if (debug) console.log(tag, 'account: ', account)
            if (account != 'hot' && account != 'store') {
                // test pair
                let actionId = randomstring.generate(7)
                if (debug1) console.log(tag, 'test pair: ' + account + ' hot ' + amount)
                report.actions[actionId] = coin + ' ' + amount + ' ' + account + ' hot'
            }
        }

        // build action object
        if (debug) console.log(tag, 'report: ', report)

        // save in redis
        await redBack.del('balanceActions')
        redBack.hmset('balanceActions', report.actions)
        let attachment = views.smartDisplay(report.actions, "test tx's")

        return report
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}
