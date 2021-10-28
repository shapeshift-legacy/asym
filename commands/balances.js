/**
 * Created by highlander on 5/30/17.
 */

const config = require('../config')
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const balances = require('./../modules/balances.js')
const views = require('./../modules/views.js')
const cc = require('./../modules/coincap.js')
const settings = require('./../modules/settings.js')

module.exports = {

    balancesBTC: async function (coin, account) {
        let tag = ' | balances | '

	      try {
            // assume bitcoin
            let key = coin + 'CombinedBalance'
            let balances = await redBack.hgetall('btcBalances')
	          // balances = balances.toString()

            return balances
        } catch (e) {
            console.error(tag, 'e: ', e)
            throw Error('e: ', e)
        }
    }
}
