/**
 * Created by highlander on 5/30/17.
 */

const config = require('../config')
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

//
const ab = require('./../modules/auto-balance.js')
const yubikey = require('./../modules/yubikey.js')
const balancer = require('./../modules/balancer.js')

const TAG = ' | actions | '

module.exports = {

    actions: function () {
        return redBack.hgetall('balanceActions')
    },
    perform: async function (action, auth) {
        let response = await yubikey.authenticate(auth)
        console.log(TAG, 'response: ', response)
        if (response.success) {
            return ab.perform(action)
        } else {
            const output = {
                succcess: false,
                msg: response.msg,
            }
            return output
        }
    },
    performAll: async function (auth) {
        let response = await yubikey.authenticate(auth)
        if (response.success) {
            return ab.performAll()
        } else {
            const output = {
                succcess: false,
                msg: response.msg,
            }
            return output
        }
    },
    balance: async function (coin, amount, source, destination, auth) {
        let response = await yubikey.authenticate(auth)
        console.log(TAG, 'response: ', response)

        if (response.success) {
            return balancer.balance(coin, amount, source, destination, response.user)
        } else {
            const output = {
                succcess: false,
                msg: response.msg,
            }
            return output
        }
    }
}
