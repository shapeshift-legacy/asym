/**
 * Created by highlander on 5/30/17.
 */

const ab = require('./../modules/auto-balance')
const yubikey = require('./../modules/yubikey.js')
const ss = require('./../modules/shapeshift.js')
const settingModule = require('./../modules/settings.js')

const Redis = require('then-redis')
const config = require('../config')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const env = process.env.ENVIRONMENT

const debug = true
module.exports = {

    autonomous: function () {
        const autonomous = ab.autonomous()
        return { autonomous }
    },
    autonomousOn: async function (auth) {
        const output = await yubikey.authenticate(auth)
        if (output.success) {
            ab.autonomousOn()
            return { msg: 'I have free will for forever' }
        } else {
            const response = {
                succcess: false,
                msg: output.msg,
            }
            return response
        }
    },
    autonomousOff: async function (auth) {
        const output = await yubikey.authenticate(auth)
        if (output.success) {
            ab.autonomousOff()
            return { success: true }
        } else {
            const output = {
                succcess: false,
                msg: output.msg,
            }
            return output
        }
    },

    setBtcMaster: function (selection) {
        if (selection === 'btcg1' || selection === 'btcg2' || selection === 'btcg3' || selection === 'btcg4' || selection === 'btcg5') {
            //
            return redBack.set('btcMaster',selection)
        } else {
            return 'invalid selection ' + selection + ' (example: btcg1-5)'
        }
    },

    setLtcMaster: function (selection) {
        if (selection === 'ltcg1' || selection === 'ltcg2' || selection === 'ltcg3' || selection === 'ltcg4' || selection === 'ltcg5') {
            //
            return redBack.set('ltcMaster',selection)
        } else {
            return 'invalid selection ' + selection + ' (example: btcg1-5)'
        }
    },

    getMaster: function (coin) {
        coin = coin.toLowerCase()
        return redBack.get(coin + 'Master')
    },

    coins: function () {
        console.log('checkpoint!!!!')
        return redBack.smembers('autoBalance:coins')
    },

    nerf: function (coin, exchange) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken' || exchange === 'binance' || exchange === 'tagomi') {
            coin = coin.toLowerCase()
            let path = 'hot_' + exchange
            return redBack.sadd('nerfed:' + coin, path)
        } else {
            return 'invalid exchange!! inp: ' + exchange
        }
    },

    unNerf: function (coin, exchange) {
        if (exchange === 'poloniex' || exchange === 'bittrex' || exchange === 'bitfinex' || exchange === 'btce' || exchange === 'kraken' || exchange === 'binance' || exchange === 'tagomi') {
            coin = coin.toLowerCase()
            let path = 'hot_' + exchange
            return redBack.srem('nerfed:' + coin, path)
        } else {
            return 'invalid exchange!! inp: ' + exchange
        }
    },

    nerfed: async function (coin) {
        if (coin) {
            return redBack.smembers('nerfed:' + coin)
        } else {
            let keys = await redBack.keys('nerfed:*')
            console.log('keys: ', keys)
            let output = []
            for (let i = 0; i < keys.length; i++) {
                let results = await redBack.smembers(keys[i])
                for (let j = 0; j < results.length; j++) {
                    output.push(results[j])
                }
            }
            return output
        }
    },

    updateCoins: function () {
        return settingModule.updateCoins()
    },
    coinOverview: async function () {
        let coins
        let output = {}
        output.enabled = []
        output.disabled = []
        if (env == 'production') {
            coins = await redBack.smembers('autoBalance:coins')
        } else {
            coins = await redBack.smembers('autoBalance:coins:staging')
        }
        // get coins from SS
        let ssCoins = await ss.coins('prod')
        if (debug) console.log('ssCoins: ', ssCoins)

        let online = ssCoins.online
        // coins on asym
        for (let i = 0; i < online.length; i++) {
            let coin = online[i]
            if (coins.indexOf(coin) >= 0) {
                //
                output.enabled.push(coin)
            } else {
                output.disabled.push(coin)
            }
        }

        // coins on SS but OFF asym

        // later coins with broken paths
        return output
    },
    // coinsStaging: function ()
    // {
    //     return redBack.smembers("autoBalance:coins:staging");
    // },
    addCoin: async function (coin, auth) {
        const output = await yubikey.authenticate(auth)
        if (output.success) {
            // remove from broken
            // get all broken
            // final all with coin
            // remove all

            return redBack.sadd('autoBalance:coins', coin)

        } else {
            const final = {
                success: false,
                msg: output.msg,
            }
            return final
        }
    },

    addAllCoins: async function (auth) {
        const output = await yubikey.authenticate(auth)
        if (output.success) {
            let ssCoins = await ss.coins('prod')
            if (debug) console.log('ssCoins: ', ssCoins)

            let online = ssCoins.online
            // coins on asym
            for (let i = 0; i < online.length; i++) {
                let coin = online[i]
                coin = coin.toLowerCase()

                redBack.sadd('autoBalance:coins', coin)

            }
            return { complete: true }
        } else {
            const resp = {
                success: false,
                msg: output.msg,
            }
            return resp
        }
    },

    // addCoinStaging: async function (coin,auth)
    // {
    //     const output = await yubikey.authenticate(auth)
    //     if(output.success){
    //         return redBack.sadd("autoBalance:coins:staging",coin);
    //     }else{
    //         const output = {
    //             success:false,
    //             msg:output.msg,
    //         }
    //         return output
    //     }
    //
    // },

    removeCoin: async function (coin, auth) {
        const output = await yubikey.authenticate(auth)
        if (output.success) {

	        return redBack.srem('autoBalance:coins', coin)

        } else {
            const output = {
                success: false,
                msg: output.msg,
            }
            return output
        }
    },
    // removeCoinStaging: async function (coin,auth)
    // {
    //     const output = await yubikey.authenticate(auth)
    //     if(output.success){
    //         return redBack.srem("autoBalance:coins:staging",coin);
    //     }else{
    //         const output = {
    //             success:false,
    //             msg:output.msg,
    //         }
    //         return output
    //     }
    // },
    removeAllCoins: async function (auth) {
        const output = await yubikey.authenticate(auth)
        if (output.success) {

            return redBack.del('autoBalance:coins')

        } else {
            const resp = {
                success: false,
                msg: output.msg,
            }
            return resp
        }
    }
}
