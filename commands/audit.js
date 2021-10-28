/**
 * Created by highlander on 7/12/17.
 */
/**
 * Created by highlander on 5/30/17.
 */

const config = require('../config')
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

//
const audit = require('./../modules/audit.js')

const TAG = ' | actions | '

module.exports = {

    coinBalanceByDays: function (coin, days) {
        return audit.coinBalanceByDays(coin, days)
    },
    coinBalanceTimeframe: function (coin, start, stop) {
        return audit.coinBalanceByDays(coin, start, stop)
    },
}
