/**
 * Created by highlander on 5/26/17.
 */
// modules
const ss = require('./shapeshift.js')

const Redis = require('then-redis')
const config = require('../config')
// redis

const redBack = require('./redis.js')

// internal modules
const balances = require('./balances.js')
const views = require('./views.js')
// const analyzer = require('./analyzer.js')

const TAG = ' | settings | '

module.exports = {
    // is in blacklist
    percentagesByCoin: function () {
        return percentages_by_coin()
    },
    /*  coinInfo: function (coin)
    {
        return get_coin_info(coin);
    }, */
    updateCoins: function () {
        return update_coin_status()
    },
    retarget: function () {
        return retarget_max_min()
    },
    coins: function () {
        return get_coins()
    },
    position: function () {
        return get_position()
    },
    balances: function () {
        return balances_by_coin()
    },
    rules: function (coin) {
        return rules_by_account(coin)
    }
}

/*****************************************
// Primary
//****************************************/

const update_coin_status = async function () {
    let tag = TAG + ' | update_coin_status | '
    const debug = false
    try {
        let env = config.setting
        let coins = await (ss.coins('prod'))
        coins = coins.online

        if (debug) console.log(tag, 'coins: ', coins)

        // if on asym but not shapeshift remove it!
        let coinsOnAsym = await get_coins()
        if (debug) console.log(tag, 'coinsOnAsym: ', coinsOnAsym)
        if (debug) console.log(tag, 'coins: ', coins)
        for (let i = 0; i < coinsOnAsym.length; i++) {
            let coin = coinsOnAsym[i]
            if (debug) console.log(tag, 'coin: ', coin)
            if (coins.indexOf(coin.toUpperCase()) === -1) {
                if (debug) console.log('NOT FOUND! REMOVING! ' + coin)
                views.displayString('coin not found on frontend! coin: ' + coin)
                // remove it!
                // await remove_coin(coin)
            }
        }

        // if on shapeshift but not asym mark unconfigured!
        for (let i = 0; i < coins.length; i++) {
            let coin = coins[i]
            if (coinsOnAsym.indexOf(coin) === -1) {
                redBack.sadd('asym:offline', coin)
            }
        }

        //
        let unconfigured = await get_unconfigured_coins()
        for (let i = 0; i < unconfigured.length; i++) {
            let coin = unconfigured[i]
            // remove unconfigured!
            views.displayString('Unconfigured coin REMOVING! ' + coin)
            await remove_coin(coin)
        }

        // get broken
        let brokenCoins = await get_broken_coins()
        //
        for (let i = 0; i < brokenCoins.length; i++) {
            let coin = brokenCoins[i]
            views.displayString('Balance endpoint is broken FIXME! coin: ' + coin)
            // await remove_coin(coin)
        }
        // remove broken

        return true
    } catch (e) {
        console.error(tag, 'e: ', e)
    }
}

const remove_coin = async function (coin) {
    const tag = TAG + ' | get_broken_coins | '
    const debug = false
    try {
        let env = config.setting
        if (env == 'prod') {
            return redBack.srem('autoBalance:coins', coin)
        } else {
            return redBack.srem('autoBalance:coins:staging', coin)
        }
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const get_broken_coins = async function () {
    const tag = TAG + ' | get_broken_coins | '
    const debug = false
    try {
        let paths = await redBack.smembers('brokenPaths')

        let output = []
        for (let i = 0; i < paths.length; i++) {
            let path = paths[i]
            path = path.split('_')
            let view
            if (path[1] === 'hot') {
                view = ':' + path[0] + ': :' + path[1] + ': :arrow_forward: :' + path[2] + ': '
                output.push(path[0])
            }
        }

        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const get_unconfigured_coins = async function () {
    const tag = TAG + ' | get_unconfigured_coins | '
    const debug = false
    try {
        let output = []
        let coins = await get_coins()

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

// get balances from redis analyze
let percentages_by_coin = async function (position) {
    const tag = TAG + ' | percentages_by_coin | '
    const debug = true
    try {
        // get balances object from redis
        if (!position) position = await balances.byCoin()
        if (!position) throw Error('101: balances not found!')

        const percentagesByCoin = {}
        const coins = await get_coins()
	    console.log(tag,"coins: ",coins)
        // iterate over by coin
        for (let i = 0; i < coins.length; i++) {
            // get current percentages
            const coin = coins[i]
            const coinBalance = position[coin]
            //
            if (coinBalance) {
                if (debug) console.log(tag, 'coinBalance: ', coinBalance)

                // get total
                let total = 0
                let accounts = Object.keys(coinBalance)
                for (let j = 0; j < accounts.length; j++) {
                    let account = accounts[j]
                    if (coinBalance[account] < 0) coinBalance[account] = 1
                    if (coinBalance[account]) total = total + parseFloat(coinBalance[account])
                }

                if (!percentagesByCoin[coin]) percentagesByCoin[coin] = {}
                percentagesByCoin[coin].total = total

                // get percentage by account
                let accounts2 = Object.keys(coinBalance)
                for (let j = 0; j < accounts2.length; j++) {
                    let account = accounts2[j]
                    if (coinBalance[account]) {
                        const percentage = (parseFloat(coinBalance[account]) / total) * 100
                        percentagesByCoin[coin][account] = parseInt(percentage)
                    }
                }
            } else {
                console.error(tag, coin + ' doesnt have a balance! ')
            }
        }

        if (debug) console.log('percentagesByCoin: ', percentagesByCoin)
        return percentagesByCoin
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

// const get_coin_info = async function(coin) {
//     const tag = TAG+" | get_coin_info | "
//     const debug = false
//     try {
//         //get balances of coin
//         const balancesByCoin = await balances_by_coin()
//         if(debug) console.log(tag, "balancesByCoin: ",balancesByCoin)
//         if(debug) console.log(tag, "balancesofCoin: ",balancesByCoin[coin])
//         const balances = balancesByCoin[coin]
//
//         //get limits of coin
//         const rules = await redBack.hgetall("rules:"+coin.toUpperCase())
//         if(debug) console.log(tag, "rules: ",rules)
//
//         const analysis = await analyzer.checkRules(coin,balances,rules)
//         if(debug) console.log(tag, "analysis: ",analysis)
//
//         //if outside of limits explain why you cant fix
//
//         return analysis
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }

const retarget_max_min = async function () {
    const tag = TAG + ' | retarget_max_min | '
    const debug = false
    const debug1 = false
    try {
        // get balancesBycoin
        const position = await balances.byCoin()
        // get current percentages by coin
        const percentagesByCoin = await percentages_by_coin()
        if (debug1) console.log(tag, 'percentagesByCoin: ', percentagesByCoin)

        // get online coins
        const coins = await get_coins()
        // iterate over coins
        for (let i = 0; i < coins.length; i++) {
            const coin = coins[i]
            // get current percentages
            if (debug) console.log(tag, 'coin: ', coin)
            const coinBalance = position[coin]
            if (debug) console.log(tag, 'coinBalance: ', coinBalance)

            // iterate over accounts
            let accounts = Object.keys(coinBalance)
            for (let j = 0; j < accounts.length; j++) {
                let account = accounts[j]
                // get target

                const percentageTarget = await redBack.hget('rules:percentage:' + coin, account)
                if (percentageTarget) {
                    if (debug) console.log(tag, 'percentageTarget: ', percentageTarget)

                    const totalAsset = percentagesByCoin[coin].total
                    if (debug) console.log(tag, account + 'totalAsset: ', totalAsset)

                    const targetAmount = totalAsset * (percentageTarget / 100)
                    if (debug) console.log(tag, account + 'targetAmount: ', targetAmount)

                    // get max
                    const maxForAccount = targetAmount * 1.02
                    if (debug) console.log(tag, account + ' maxForAccount: ', maxForAccount)

                    // get min
                    const minForAccount = targetAmount * 0.98
                    if (debug) console.log(tag, account + ' minForAccount: ', minForAccount)

                    // save rules
                    redBack.hset('rules:' + coin.toUpperCase(), account + '_max', parseInt(maxForAccount))
                    redBack.hset('rules:' + coin.toUpperCase(), account + '_min', parseInt(minForAccount))
                } else {
                    console.error(tag, coin + ' missing rule for: ', account)
                    redBack.hset('rules:' + coin.toUpperCase(), account + '_max', 0)
                    redBack.hset('rules:' + coin.toUpperCase(), account + '_min', 0)
                }
            }
        }
        return true
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const get_coins = async function () {
    let tag = TAG + ' | get_coins | '
    try {
        // let staging have more coins

        let coins = await redBack.smembers('autoBalance:coins')

        return coins
    } catch (e) {
        console.error(tag, 'e: ', e)
    }
}

// get balances from redis analyze
const get_position = async function () {
    const tag = TAG + ' | get_position | '
    const debug = false
    const debug1 = false
    try {
        return balances.position()
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

// get balances
// const balances_by_coin = async function() {
//     const tag = TAG+" | balances_by_coin | "
//     const debug = false
//     try {
//         const balances = await get_position()
//         const coinBalances = {}
//
//         //iterate over all accounts
//         // let account = Object.keys(balances)
//         // for (let i = 0; i < analysis.length; i++) {
//         //
//         // }
//         Object.keys(balances).forEach(async function (account) {
//             //iterate each coin
//             if(debug) console.log(tag,"account: ",account)
//             Object.keys(balances[account]).forEach(async function (coin) {
//                 //coin = coin.toUpperCase()
//                 if(debug) console.log(tag,"coin: ",coin)
//                 if(!coinBalances[coin]) coinBalances[coin] = {}
//                 if(!coinBalances[coin][account]) coinBalances[coin][account] = {}
//                 coinBalances[coin][account]=parseInt(balances[account][coin].balance)
//             })
//         })
//         if(debug) console.log(tag,"coinBalances: ",coinBalances)
//         return coinBalances
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }

const rules_by_account = async function (coin) {
    const tag = TAG + ' | rules_by_account | '
    const debug = false
    try {
        const rulesByAccount = {}
        const rules = await redBack.hgetall('rules:' + coin.toUpperCase())
        // parse rules
        Object.keys(rules).forEach(async function (ruleL) {
            const ruleTokens = ruleL.split('_')
            const account = ruleTokens[0].toLowerCase()
            const rule = ruleTokens[1].toLowerCase()
            if (!rulesByAccount[account]) rulesByAccount[account] = {}
            if (!rulesByAccount[account][rule]) rulesByAccount[account][rule] = {}
            rulesByAccount[account][rule] = rules[ruleL]
        })
        if (debug) console.log(tag, 'rulesByAccount: ', rulesByAccount)

        return rulesByAccount
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}
