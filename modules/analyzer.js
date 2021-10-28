/**
 * Created by highlander on 3/24/17.
 */

// const async = require('asyncawait/async')
// const await = require('asyncawait/await')
const _ = require('lodash')
const randomstring = require('randomstring')
const balances = require('./balances.js')
const settings = require('./settings.js')
const pending = require('./pending.js')

const TAG = ' | analyzer | '
// settings
const config = require('../config')
const servers = config.COIN_SERVERS
const Redis = require('then-redis')
// redis
const redBack = require('./redis.js')
const log = require("loggerdog-client")()

module.exports = {
    // is in blacklist
    analyze: function (balances) {
        return analyze_position(balances)
    },
    emergencyActions: function (coin, coinBalance, irregularity) {
        return emergency_fill_hot(coin, coinBalance, irregularity)
    },
    findBestDestination: function (coin, coinBalance, irregularity) {
        return find_home_for_overage(coin, coinBalance, irregularity)
    },
    findBestSource: function (coin, coinBalance, irregularity) {
        return find_liquidity_for_account(coin, coinBalance, irregularity)
    },
    checkRules: function (coin, balances, rules) {
        return check_rules(coin, balances, rules)
    }
}

//* **********************************
// Primary
//* **********************************

const emergency_fill_hot = async function (coin, coinBalance, irregularity) {
    const tag = TAG + ' | emergency_fill_hot | '
    const debug = false
    const debug1 = true
    try {
        let actions = []
        log.debug(tag, 'coinBalance: ', coinBalance)
        log.debug(tag, 'irregularity: ', irregularity)
        const summary = {}
        summary.coin = coin
        summary.irregularity = irregularity
        summary.coinBalance = coinBalance
        summary.log = ' emergency fill hot \n'

        // get rules for coin
        const coinRules = await rules_by_account(irregularity.coin)
        summary.coinRules = coinRules
        log.debug(tag, 'coinRules: ', coinRules)

        // current percentages
        // const percentagesByCoin = await percentages_by_coin()
        // if(debug1) log.info(tag,"percentagesByCoin: ",percentagesByCoin)
        // log.debug(tag,"percentages: ",percentagesByCoin[coin])
        //
        // //
        // if(percentagesByCoin[coin])summary.percentagesActual = percentagesByCoin[coin]
        summary.percentagesTarget = await redBack.hgetall('rules:percentage:' + coin)

        // amount over
        let amountUnder = irregularity.min - irregularity.actual
        amountUnder = parseInt(amountUnder)
        summary.amountUnder = amountUnder

        // amount needed
        log.debug(tag, 'amountUnder: ', amountUnder)

        Object.keys(coinBalance).forEach(function (account) {
            if (account !== 'hot' && account !== 'btce') {
                log.debug(tag, 'balance: ', coinBalance[account])
                if (coinBalance[account] > amountUnder) {
                    // send amount needed to return to min
                    const action = { coin, amount: amountUnder, from: account, to: 'hot' }
                    actions.push(action)
                } else {
                    // empty account to 0
                    const action = { coin, amount: coinBalance[account], from: account, to: 'hot' }
                    actions.push(action)
                }
            }
        })
        log.debug(tag, ' actions to take! : ', actions)
        let eActions = []
        // for each action
        for (let i = 0; i < actions.length; i++) {
            let chosen = actions[i]

            let actionId = randomstring.generate(7)
            summary.actionId = actionId
            actionId = actionId.toUpperCase()

            // balances after action
            const amountInAccountAfterAction = parseInt(chosen.amount) - parseInt(coinBalance[chosen.to])
            const amountInSourceAfter = parseInt(irregularity.actual) + parseInt(chosen.amount)
            summary.balancesAfter = {}
            summary.balancesAfter[chosen.to] = parseInt(amountInAccountAfterAction)
            summary.balancesAfter['hot'] = parseInt(amountInSourceAfter)

            // assign actionId
            const output = {}
            output[actionId] = chosen
            output.amount = chosen.amount
            log.debug(tag, 'output: ', output)

            // save summary!
            log.debug(tag, 'fullsummary: * ', summary)
            redBack.set(actionId, JSON.stringify(summary))
            eActions.push(output)
        }
        log.debug(tag, ' actions to take!(final) : ', eActions)
        return eActions
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const distance_to_target = async function (coin, irregularity, coinRules, coinbalances) {
    const tag = TAG + ' | distance_to_target | '
    const debug = false
    const debug1 = false
    try {
        const maxAmountWanted = parseInt(coinRules[irregularity.source].max)
        const minAmountWanted = parseInt(coinRules[irregularity.source].min)

        let target = maxAmountWanted - minAmountWanted
        target = target / 2
        target = parseInt(target)
        target = target + minAmountWanted

        // | actual - target | abs
        const sumNTM = irregularity.actual - target

        return Math.abs(sumNTM)
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const find_liquidity_for_account = async function (coin, coinBalance, irregularity) {
    const tag = TAG + ' | find_liquidity_for_account | '
    const debug = true
    const debug1 = true
    try {
        log.debug(tag, '*** coin: ', coin)
        log.debug(tag, 'coinBalance: ', coinBalance)
        log.info(tag, 'irregularity: ', JSON.stringify(irregularity))
        let actionId = randomstring.generate(7)
        const summary = {}
        summary.actionId = actionId
        actionId = actionId.toUpperCase()
        summary.coin = coin
        summary.irregularity = irregularity
        summary.coinBalance = coinBalance
        summary.log = ' Looking for liquity for refill \n'

        // current percentages
        // current percentages
        // const percentagesByCoin = await percentages_by_coin()
        // log.debug(tag,"percentagesByCoin: ",percentagesByCoin)
        // if(debug1) console.log(tag,"percentages: ",percentagesByCoin[coin])
        //
        // //
        // if(percentagesByCoin[coin]) summary.percentagesActual = percentagesByCoin[coin]
        summary.percentagesTarget = await redBack.hgetall('rules:percentage:' + coin)

        // get rules for coin
        const coinRules = await rules_by_account(irregularity.coin)
        summary.coinRules = coinRules
        if (!coinRules[irregularity.source]) throw Error('100: no rules for account: ' + irregularity.source)

        log.debug(tag, 'coinRules: ', coinRules)
        // amount over
        let amountUnder = irregularity.min - irregularity.actual
        amountUnder = parseInt(amountUnder)
        summary.amountUnder = amountUnder

        const actions = []
        // get all sources of liquidity
        Object.keys(coinBalance).forEach(function (account) {
            // distance to min
            if (irregularity.source != account && coinRules && coinRules[account] && coinRules[account].min) {
                log.debug(tag, 'account: ', account)

                const accountMin = coinRules[account].min
                log.debug(tag, 'accountMin: ', accountMin)
                log.debug(tag, 'actual: ', coinBalance[account])

                // actual - min = avaibleLiquidity
                const avaibleLiquidity = coinBalance[account] - accountMin
                log.debug(tag, 'availableLiquidity: ', avaibleLiquidity)

                // if greater > 0
                if (avaibleLiquidity > 0) {
                    if (account === 'hot' || irregularity.source === 'hot') {
                        const action = { coin, amount: avaibleLiquidity, from: account, to: irregularity.source }
                        actions.push(action)
                    }
                }
            }
        })
        log.debug(tag, 'actions available: ', actions)
        // sort by amount
        const sorted = actions.sort(function (a, b) { return parseFloat(a.amount) - parseFloat(b.amount) })
        log.debug(tag, 'sorted actions: ', sorted)

        const chosen = sorted[sorted.length - 1]
        log.debug(tag, 'chosen action: ', chosen)
        if (!chosen) return null // nothing found!

        // amount needed to target
        const amountNeeded = await distance_to_target(coin, irregularity, coinRules, coinBalance)
        log.debug(tag, 'amountNeeded: ', amountNeeded)
        if (amountNeeded < chosen.amount) chosen.amount = amountNeeded

        // balances after action
        const amountInAccountAfterAction = parseInt(coinBalance[chosen.from]) - parseInt(chosen.amount)
        const amountInSourceAfter = parseInt(chosen.amount) + parseInt(irregularity.actual)
        summary.balancesAfter = {}
        summary.balancesAfter[chosen.from] = parseInt(amountInAccountAfterAction)
        summary.balancesAfter[irregularity.source] = parseInt(amountInSourceAfter)

        // assign actionId
        const output = {}
        output[actionId] = chosen
        output.amount = chosen.amount
        // save summary!
        log.debug(tag, '(under) fullsummary: * ', summary)
        redBack.set(actionId, JSON.stringify(summary))

        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const find_home_for_overage = async function (coin, coinBalance, irregularity) {
    const tag = TAG + ' | find_home_for_overage | '
    const debug = true
    const debug1 = true
    try {
        log.debug(tag, 'coinBalance: ', coinBalance)
        log.info(tag, 'irregularity: ', JSON.stringify(irregularity))
        let actionId = randomstring.generate(7)
        const summary = {}
        summary.actionId = actionId
        actionId = actionId.toUpperCase()
        summary.coin = coin
        summary.irregularity = irregularity
        summary.coinBalance = coinBalance
        summary.log = ' Looking for home for overage \n'

        // get rules for coin
        const coinRules = await rules_by_account(irregularity.coin)
        summary.coinRules = coinRules
        log.debug(tag, 'coinRules: ', coinRules)

        // current percentages
        // const percentagesByCoin = await percentages_by_coin()
        // if(debug1) console.log(tag,"percentagesByCoin: ",percentagesByCoin)
        // log.debug(tag,"percentages: ",percentagesByCoin[coin])
        //
        // //
        // if(percentagesByCoin[coin])summary.percentagesActual = percentagesByCoin[coin]
        summary.percentagesTarget = await redBack.hgetall('rules:percentage:' + coin)

        // amount over
        let amountOver = irregularity.actual - irregularity.max
        amountOver = parseInt(amountOver)
        summary.amountOver = amountOver

        const actions = []
        // find account that can asorb most liquidity
        Object.keys(coinBalance).forEach(function (account) {
            // distance to min
            if (irregularity.source != account && coinRules && coinRules[account] && coinRules[account].max) {
                log.debug(tag, 'account: ', account)

                const accountMax = coinRules[account].max
                log.debug(tag, 'accountMax: ', accountMax)
                log.debug(tag, 'actual: ', coinBalance[account])

                // actual - min = avaibleLiquidity
                const avaibleLiquidityAbsorbtion = accountMax - coinBalance[account]
                log.debug(tag, 'availableLiquidityAbsorbtion: ', avaibleLiquidityAbsorbtion)

                let amountToSend = 0
                if (amountOver > avaibleLiquidityAbsorbtion) {
                    amountToSend = avaibleLiquidityAbsorbtion
                } else if (avaibleLiquidityAbsorbtion > amountOver) {
                    amountToSend = amountOver
                }

                // if greater > 0
                if (avaibleLiquidityAbsorbtion > 0) {
                    const action = { coin, amount: amountToSend, from: irregularity.source, to: account }
                    actions.push(action)
                }
            }
        })

        log.debug(tag, 'actions available: ', actions)
        // sort by amount
        const sorted = actions.sort(function (a, b) { return parseFloat(a.amount) - parseFloat(b.amount) })
        log.debug(tag, 'sorted actions: ', sorted)

        const chosen = sorted[sorted.length - 1]
        log.debug(tag, 'chosen action: ', chosen)
        if (!chosen) return null

        // TODO this doesnt matter for overage????
        // amount needed to target
        // const amountNeeded = await distance_to_target(coin,irregularity,coinRules,coinBalance))
        // log.debug(tag,"amountNeeded: ",amountNeeded)
        // if(amountNeeded < chosen.amount) chosen.amount = amountNeeded

        // balances after action
        const amountInAccountAfterAction = parseInt(chosen.amount) + parseInt(coinBalance[chosen.to])
        const amountInSourceAfter = parseInt(irregularity.actual) - parseInt(chosen.amount)
        summary.balancesAfter = {}
        summary.balancesAfter[chosen.to] = parseInt(amountInAccountAfterAction)
        summary.balancesAfter[irregularity.source] = parseInt(amountInSourceAfter)

        // assign actionId
        const output = {}
        output[actionId] = chosen
        output.amount = chosen.amount
        log.debug(tag, 'output: ', output)

        // save summary!
        log.info(tag, 'fullsummary: * ', summary)
        redBack.set(actionId, JSON.stringify(summary))

        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const check_rules = async function (coin, balances, rules) {
    const tag = TAG + ' | check_rules | '
    const debug = false
    try {
        // if(!rules) throw Error("100: No rules for coin: "+coin)
        // if(!balances) throw Error("100: No balances for coin: "+coin)
        if (!rules) return false
        if (!balances) return false

        // console.log(tag,coin,balances,rules)
        log.debug(tag, 'rules: ', rules)
        log.debug(tag, 'balances: ', balances)
        const irregularities = []
        const rulesByAccount = {}
        // parse rules
        Object.keys(rules).forEach(function (ruleL) {
            const ruleTokens = ruleL.split('_')
            const account = ruleTokens[0].toLowerCase()
            const rule = ruleTokens[1].toLowerCase()
            if (!rulesByAccount[account]) rulesByAccount[account] = {}
            if (!rulesByAccount[account][rule]) rulesByAccount[account][rule] = {}
            rulesByAccount[account][rule] = rules[ruleL]
        })
        log.debug(tag, 'rulesByAccount: ', rulesByAccount)

        // apply all rules
        Object.keys(rulesByAccount).forEach(function (account) {
            log.debug(tag, 'account: ', account)
            log.debug(tag, 'thresholds: ', rulesByAccount[account])
            // min
            // if balance is lower, get action to higher
            if (balances[account] && parseFloat(balances[account]) < parseFloat(rulesByAccount[account]['min'])) {
                const summary = account + ' Below min: ' + rulesByAccount[account]['min'] + ' actual: ' + balances[account]
                console.log(tag, 'summary: ', summary)
                const position = {
                    coin,
                    event: 'under',
                    summary,
                    source: account,
                    actual: balances[account],
                    min: parseFloat(rulesByAccount[account]['min'])
                }
                irregularities.push(position)
            } else if (!balances[account]) {
                //console.log(tag, ' Rule made for account not defined! account:', account)
            }
            // max
            if (balances[account] && parseFloat(balances[account]) > parseFloat(rulesByAccount[account]['max'])) {
                const summary = account + ' above Maximum: ' + rulesByAccount[account]['max'] + ' actual: ' + balances[account]
                console.log(tag, 'summary: ', summary)
                const position = {
                    coin,
                    event: 'over',
                    summary,
                    rule: rulesByAccount[account],
                    source: account,
                    actual: balances[account],
                    max: parseFloat(rulesByAccount[account]['max'])
                }
                irregularities.push(position)
            } else if (!balances[account]) {
                //console.error(tag, ' Rule made for account not defined! account:', account)
            }
        })

        return irregularities
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

// detect thresholds
const analyze_position = async function () {
    const tag = TAG + ' | analyze_position | '
    const debug = true
    try {
        // index balances by coins
        const coinBalances = await balances_by_coin()
		log.debug(tag,"coinBalances: ",JSON.stringify(coinBalances))
        // iterate over all accounts

        // iterate over all coins

        // validate rules
        const output = []
        // only check rules on setup coins
        const coins = await settings.coins()
        log.debug(tag, 'coins: ', coins)

        // iterate over by coin
        for (let i = 0; i < coins.length; i++) {
            const coin = coins[i]
            log.debug(tag, 'coin: ', coin)
            const balances = coinBalances[coin]
            log.debug(tag, 'balances: ', balances)
            const rules = await redBack.hgetall('rules:' + coin.toUpperCase())
            log.debug(tag, 'rules: ', rules)
            const irregularities = await check_rules(coin, balances, rules)
            log.debug(tag, 'irregularities: ', irregularities)
            log.debug(tag, 'irregularities: ', irregularities.length)
            for (let j = 0; j < irregularities.length; j++) {
                log.debug(tag, 'result: ', irregularities[j])
                output.push(irregularities[j])
                log.debug(tag, 'output: ', output)
            }
        }
        log.debug(tag, 'outputFINAL: ', output)

        // irregularities

        // recommended actions

        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

//* ************************************
// lib
//* ************************************
// const is_action_valid = async  function() {
//     const tag = TAG+" | get_position | "
//     try {
//
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// })

// get coins
// let get_coins = async function(){
//     let tag = TAG+" | get_coins | "
//     try{
//         //let staging have more coins
//         let env = config.env.setting
//         let coins
//         if(env == "prod"){
//             coins = await redBack.smembers("autoBalance:coins")
//         }else{
//             coins = await redBack.smembers("autoBalance:coins:staging")
//         }
//         return coins
//     }catch(e){
//         console.error(tag,"e: ",e)
//     }
// }
//
// //get balances from redis analyze
// const percentages_by_coin = async  function() {
//     const tag = TAG+" | percentages_by_coin | "
//     const debug = false
//     try {
//         //get balances object from redis
//         const balances = await balances_by_coin()
//         if(!balances) throw Error("101: balances not found!")
//
//         const percentagesByCoin = {}
//         const coins = await get_coins()
//         // iterate over by coin
//         for (let i = 0; i < coins.length; i++) {
//             // get current percentages
//             const coin = coins[i]
//             const coinBalance = balances[coin]
//             //
//             log.debug(tag,"coinBalance: ",coinBalance)
//
//             //get total
//             let total = 0
//             Object.keys(coinBalance).forEach(function(account) {
//                 total = total + parseFloat(coinBalance[account])
//             })
//             if(!percentagesByCoin[coin]) percentagesByCoin[coin] = {}
//             percentagesByCoin[coin].total = total
//
//             //get percentage by account
//             Object.keys(coinBalance).forEach(function(account) {
//                 const percentage = (parseFloat(coinBalance[account]) / total) * 100
//                 percentagesByCoin[coin][account] = parseInt(percentage)
//             })
//         }
//
//         log.debug("percentagesByCoin: ",percentagesByCoin)
//         return percentagesByCoin
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }

// get balances from redis analyze
// const get_position = async  function() {
//     const tag = TAG+" | get_position | "
//     const debug = false
//     const debug1 = false
//     try {
//
//
//         return balances.position()
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }

const balances_by_coin = async function () {
    const tag = TAG + ' | balances_by_coin | '
    const debug = false
    try {
        const position = await balances.position()
        const coinBalances = {}

        // iterate over all accounts
        Object.keys(position).forEach(function (account) {
            // iterate each coin
            log.debug(tag, 'account: ', account)
            Object.keys(position[account]).forEach(function (coin) {
                // coin = coin.toUpperCase()
                log.debug(tag, 'coin: ', coin)
                if (!coinBalances[coin]) coinBalances[coin] = {}
                if (!coinBalances[coin][account]) coinBalances[coin][account] = {}
                coinBalances[coin][account] = position[account][coin].balance
            })
        })
        log.debug(tag, 'coinBalances: ', coinBalances)
        return coinBalances
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const rules_by_account = async function (coin) {
    const tag = TAG + ' | rules_by_account | '
    const debug = false
    try {
        const rulesByAccount = {}
        const rules = await redBack.hgetall('rules:' + coin.toUpperCase())
        log.debug(tag, 'rules: ', rules)
        // parse rules
        if (!rules) return null
        Object.keys(rules).forEach(function (ruleL) {
            const ruleTokens = ruleL.split('_')
            const account = ruleTokens[0].toLowerCase()
            const rule = ruleTokens[1].toLowerCase()
            if (!rulesByAccount[account]) rulesByAccount[account] = {}
            if (!rulesByAccount[account][rule]) rulesByAccount[account][rule] = {}
            rulesByAccount[account][rule] = rules[ruleL]
        })
        log.debug(tag, 'rulesByAccount: ', rulesByAccount)

        return rulesByAccount
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const pause = function (length) {
    const d = when.defer()
    const done = function () { d.resolve(true) }
    setTimeout(done, length * 1000)
    return d.promise
}
