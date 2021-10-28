const when = require('when')
const monk = require('monk')
const balancer = require('./balancer.js')
const pending = require('./pending.js')
const balances = require('./balances.js')
const analyzer = require('./analyzer.js')
const settings = require('./settings.js')

const alert = require('./alert.js')
const coins = require('./../test/services/coinHACK.js')
const config = require('../config')
const db = monk(config.MONGO_URI)
const reportsH = db.get('reports')
const log = require("loggerdog-client")()
const redBack = require('./redis.js')

const TAG = ' | auto-balance | '
let autonomous = false
let slackNerf = false
let calcPending = config.pending

let views = require('./views.js')

if (config.setting === 'prod') {
    let whitelist = require('../shapeshift-whitelists-tracked/addressesProd.js')
} else if (config.setting === 'dev') {
    let whitelist = require('../shapeshift-whitelists-tracked/addressesDev.js')
} else if (config.setting === 'staging') {
    let whitelist = require('../shapeshift-whitelists-tracked/addressesStaging.js')
} else if (config.setting === 'personal') {
    let whitelist = require('../shapeshift-whitelists-tracked/addressesPersonal.js')
} else {
    //console.error(' NOT CONFIGURED!! MISSING WHITELIST!!!')
	let whitelist = require('../shapeshift-whitelists-tracked/addressesStaging.js')
}

module.exports = {
    run: function () {
        return run_balance_bot()
    },
    autonomous: function () {
        return autonomous
    },
    autonomousOn: function () {
        return autonomousOn()
    },
    autonomousOff: function () {
        return autonomousOff()
    },
    perform: function (action) {
        return perform_action(action)
    },
    performAll: function () {
        return perform_balance_actions_auto()
    },
    balance: function () {
        return balance_addresses()
    }
}

const perform_sendFroms = async function (actions) {
    const tag = ' | run_test | '
    try {
        let report = {}

        for (let i = 0; i < actions.length; i++) {
            let action = actions[i]
            let txid = await coins.sendFrom('eth', action.source, action.desitination, action.amount)
            report[txid] = action
        }
        return report
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const balance_addresses = async function () {
    const tag = ' | run_test | '
    const debug = false
    try {
        let index = {}
        let workingSet = []
        let actions = []
        let ethAddresses = whitelist.ETH.withdraw.support
        log.debug(tag, 'ethAddresses: ', ethAddresses)

        // get balance for all ETH address
        log.debug(tag, 'coins: ', coins)

        // get total
        let total = 0
        for (let i = 0; i < ethAddresses.length; i++) {
            const balance = await coins.getAddressBalance(ethAddresses[i])
            total = total + balance
            index[ethAddresses[i]] = balance
            workingSet.push({ address: ethAddresses[i], balance })
        }
        log.debug(tag, 'index: ', index)

        // total/addresses
        let target = total / ethAddresses.length
        log.debug(tag, 'target: ', target)
        log.debug(tag, 'index: ', index)

        // heuristics

        // sort low to high
        const sortedSet = workingSet.sort(function (a, b) { return parseFloat(a.balance) - parseFloat(b.balance) })
        log.debug(tag, 'sortedSet: ', sortedSet)

        // send highest to lowest
        for (let i = 0; i < sortedSet.length; i++) {
            let entry = sortedSet[i]
            let balance = entry.balance
            // if under top off
            if (balance < target) {
                let action = {}
                // source
                let source = sortedSet[sortedSet.length - 1]
                let sourceBalance = source.balance
                let amount = target - balance
                // if can bring to target without going under
                if (sourceBalance - amount > target) {
                    action.source = source.address
                    action.destination = entry.address
                    action.amount = amount
                    actions.push(action)
                } else {
                    // send all you can
                    amount = target - sourceBalance
                    action.source = source.address
                    action.destination = entry.address
                    action.amount = amount
                    actions.push(action)
                }
                // remove last from sorted
                sortedSet.splice(sortedSet.length - 1, 1)
            }
        }
        log.debug(tag, 'actions: ', actions)

        // perform actions
        let report = await perform_sendFroms(actions)

        return report
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const run_balance_bot = async function () {
    const tag = TAG + ' | run_balance_bot | '
    const debug = true
    const debug1 = false
    try {
        log.info(tag, "**************** checkoint 1 ")
        let timeStart = new Date().getTime()
        if(debug) console.log(tag,"timeStart: ",timeStart)
        // update coins
        await settings.updateCoins()

        let pendingTxs = null

        await settings.retarget()

        // //clear pending
        // if (calcPending) {
        //     let pendingReport = await pending.clear()
        //     log.debug(tag, 'pendingReport', pendingReport)
        //     if (!slackNerf) await views.display(pendingReport, 'Pending Bot actions taken:')
        //
        //     // get pending
        //     pendingTxs = await pending.all()
        //     let pendingTxids = await redBack.smembers('pendingTx')
        //     log.debug(tag, 'pendingTxs', pendingTxs)
        //     if (!slackNerf) await views.display(pendingTxids, 'Current Pending Transactions')
        // }

	    log.info(tag, "**************** checkoint 2 ")
        const position = await balances.position()
        if (!position) throw Error('111: Failed to get balances: ')
        log.info(tag, 'position: ', JSON.stringify(position))

        const analysis = await analyzer.analyze(position)
        if (!analysis) throw Error('102: analysis empty')
        log.info(tag, 'analysis: ', JSON.stringify(analysis))

	    log.info(tag, "**************** checkoint 3 ")

        // display irregularities
        if (!slackNerf) await views.irregularities(analysis)
        if (!slackNerf) await pause(2)

	    log.info(tag, "**************** checkoint 4 ")

        let report = await take_action(analysis, pendingTxs)
        if (!report) throw Error('102: Failed to take action. ')
        log.info(tag, 'report: ', JSON.stringify(report))

        if (Object.keys(report.actions).length === 0) {
            log.debug(tag, ' No actions! ')
            if (!slackNerf) views.displayString('No actions avaible!')
            report = null
        } else {
            log.debug(tag, 'actions: ', JSON.stringify(report.actions))
            if (!slackNerf) views.actions(report.actions)
            await redBack.del('balanceActions')

            redBack.hmset('balanceActions', report.actions)

            // save report
            report.time = new Date().getTime()

            if (autonomous) {
                log.debug(tag, 'takeing actions autonomously')
	            if (!slackNerf) views.displayString('takeing actions autonomously')
                perform_balance_actions_auto()
            }
        }

        let loopTimeEnd = new Date().getTime()
        let loopTime = timeStart - loopTimeEnd
        if (!slackNerf) await views.displayString('loopTime: ' + loopTime)

        // return report
        return true
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const perform_action = async function (actionId) {
    const tag = TAG + ' | execute_action | '
    try {
        log.info(tag,"peform action: ",actionId)
        const actionInfo = await redBack.hget('balanceActions', actionId)
        if (!actionInfo) throw Error('103: No action info for: ' + actionId)
        const result = await execute_action_auto(actionInfo)

        return result
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const execute_action_auto = async function (action) {
    const tag = TAG + ' | execute_action | '
    try {
        const params = action.split(' ')
        const coin = params[0]
        const amount = params[1]
        const source = params[2]
        const destination = params[3]

        log.info(tag,{coin, amount, source, destination})
        const result = await balancer.balance(coin, amount, source, destination, 'asym')

        return result
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}
//

const perform_balance_actions_auto = async function () {
    const tag = TAG + ' | perform_balance_actions_auto | '
    const debug = false
    try {
        // get all actions
        const actions = await redBack.hgetall('balanceActions')
        const output = {}
        let actionIds = Object.keys(actions)
        for (let i = 0; i < actionIds.length; i++) {
            let action = actionIds[i]
            log.debug(tag, 'action: ', action)
            const actionId = action
            log.debug(tag, 'actionId: ', actionId)

            const actionInfo = await redBack.hget('balanceActions', action)

            const result = await execute_action_auto(actionInfo)

            // save to report
            const actionString = actionInfo.split(' ')
            const coin = actionString[0]
            const amount = actionString[1]
            const source = actionString[2]
            const destination = actionString[3]

            if (source === 'hot') {
                // if failed add to broken paths
                if (!result.txid || result.txid === '' || result.txid.length < 3) {
                    // Failed to send
                    output['result' + i] = ':stop: :' + coin + ':  *' + amount.toLocaleString() + '* :' + source + ':  :arrow_forward:   :' + destination + ':  ' + JSON.stringify(result)
                    alert.channel(' :' + coin + ': is broke! Trying again later! Error: ' + JSON.stringify(result), 'alerts')
                    redBack.sadd('brokenPaths', coin + '_' + source + '_' + destination)
                } else {
                    output['result' + i] = ':success: :' + coin + ':  *' + amount.toLocaleString() + '* :' + source + ':  :arrow_forward:   :' + destination + ':  ' + JSON.stringify(result)

                    // display to balancing
	                if (!slackNerf) views.displayStringToChannel(':success: :' + coin + ':  *' + amount.toLocaleString() + '* :' + source + ':  :arrow_forward:   :' + destination + ':  ' + JSON.stringify(result), 'balancing-events')
                    redBack.srem('brokenPaths', coin + '_' + source + '_' + destination)
                }
            } else {
                output['result' + i] = ':success: :' + coin + ':  *' + amount.toLocaleString() + '* :' + source + ':  :arrow_forward:   :' + destination + ':  ' + JSON.stringify(result)
	            if (!slackNerf) views.displayStringToChannel(':success: :' + coin + ':  *' + amount.toLocaleString() + '* :' + source + ':  :arrow_forward:   :' + destination + ':  ' + JSON.stringify(result), 'balancing-events')
            }

            let verboseInfo = await redBack.get(actionId)
            log.debug(tag, 'verboseInfo: ', verboseInfo)

            if (verboseInfo) verboseInfo = JSON.parse(verboseInfo)
            // irregularity
            const irregularity = verboseInfo.irregularity.summary

            // balanceSource before
            const balanceSourceBefore = verboseInfo.coinBalance[source]
            // balanceSource before
            const balanceDestinationBefore = verboseInfo.coinBalance[destination]

            // balanceDestination after
            const balanceSourceAfter = verboseInfo.balancesAfter[source]
            // balanceDestination after
            const balanceDestinationAfter = verboseInfo.balancesAfter[destination]

            // percent targets
            const rules = await redBack.hgetall('rules:percentage:' + coin)
            const percentTargetSource = rules[source]
            const percentTargetDestination = rules[destination]

            const element = {
                actionId,
                coin,
                amount,
                source,
                destination,
                irregularity,
                balanceSourceBefore,
                balanceDestinationBefore,
                balanceSourceAfter,
                balanceDestinationAfter,
                percentTargetSource,
                percentTargetDestination,
                txid: JSON.stringify(result)
            }

            element.time = new Date().getTime()
            element.date = new Date()
            reportsH.insert(element)
	        redBack.lpush("asym:actions:queue", JSON.stringify(element))
        }
        output.success = true
        log.debug(tag, 'final output: ', output)
	    if (!slackNerf) views.smartDisplay(output)

        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

let smart_action_filter = async function (actions, coin) {
    let tag = TAG + ' | smart_action_filter | '
    let debug = true
    try {
        log.info(tag, '**** actions: ', JSON.stringify(actions))
        let emergency = false
        let chosen = []
        let validActions = []
        let pathsPending = []
        let eActions

        // remove any options with the same source of pening
        let pendings = await pending.byCoin(coin)

        let nerfed = await redBack.smembers('nerfed:' + coin)
        for (let i = 0; i < nerfed.length; i++) {
            pathsPending.push(nerfed[i])
        }

        // get all paths
        for (let i = 0; i < pendings.length; i++) {
            //
            let pendingTx = pendings[i]
            let path = pendingTx.source + '_' + pendingTx.destination
            pathsPending.push(path)
        }
        log.debug(tag, coin + ' pathsPending: ', pathsPending)

        // remove actions that match pending
        for (let i = 0; i < actions.length; i++) {
            let action = actions[i]
            let actionId = Object.keys(action)[0]
            let actionPath = action[actionId].from + '_' + action[actionId].to
            log.debug(tag, '**** actionPath: ', actionPath)
            log.debug(tag, '**** pathsPending: ', pathsPending)
            if (pathsPending.indexOf(actionPath) < 0) {
                if (action[actionId].from === 'hot' || action[actionId].to === 'hot' && action[actionId].from != 'btce') {
                    validActions.push(action)
                } else {
                    log.debug(tag, 'invalid action: ', action)
                    actions[i].description = ' Not a valid path! path:' + actionPath
                }
            } else {
                actions[i].description = ' Action blocked by pending! path:' + actionPath
                log.debug(tag, 'action blocked by pending! action: ', action)
            }
        }

        let balancesByCoin = await balances.byCoin()
        let coinBalances = balancesByCoin[coin]
        log.debug(tag, 'coinBalances: ', coinBalances)
        let accounts = Object.keys(coinBalances)
        for (let i = 0; i < accounts.length; i++) {
            //
            let account = accounts[i]
            log.debug(tag, 'account:', account)
            let balance = coinBalances[account]
            log.debug(tag, 'balance:', balance)
        }
        log.debug(tag, '****2 actions: ', actions)


        // find action if greatest amount
        let sortedActions = validActions.sort(function (a, b) {
            return parseFloat(a.amount) - parseFloat(b.amount)
        })

        log.info(tag, 'sortedActions: ', JSON.stringify(sortedActions))
        log.info(tag, 'chosen: ', {chosen:sortedActions[sortedActions.length - 1]})

        if (sortedActions.length) {
            let chosenAction = sortedActions[sortedActions.length - 1]
            let chosenActionId = Object.keys(chosenAction)[0]

            if (!slackNerf) await views.rawActionInfoDisplay(sortedActions, ' Chosen action:' + chosenActionId)
            chosen.push(sortedActions[sortedActions.length - 1])
        }


        log.info(tag,"*** chosen: ",JSON.stringify(chosen))
        return chosen
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}
//

// smart filter possible actions to wanted actions
let take_action = async function (analysis, pendingTxs) {
    let tag = TAG + ' | take_action | '
    let debug = true
    try {
        let actionsFinal = {}
        let irregularitiesByCoin = await irregularities_by_coin(analysis)
        let position = await balances.byCoin()

        // build actions by coin
        let coins = Object.keys(irregularitiesByCoin)
        log.info(tag,"coins: ",coins)
        for (let i = 0; i < coins.length; i++) {
            let coin = coins[i]

            let coinBalance = position[coin]
            log.debug(tag, 'coinBalance: ', coinBalance)
            let irregularities = irregularitiesByCoin[coin]
            log.debug(tag, coin+ ' irregularities: ', irregularities)

            let actions = []

            for (let j = 0; j < irregularities.length; j++) {
                let irregularity = irregularities[j]
                log.info(tag, 'irregularity: ', {irregularity})

                if (irregularity.event === 'over') {
                    // find account most under max
                    let action = await analyzer.findBestDestination(coin, coinBalance, irregularity)
                    if (action) actions.push(action)
                }

                if (irregularity.event === 'under') {
                    log.debug(tag, 'irregularity:: ', irregularity)
                    // find account most under max
                    let action = await analyzer.findBestSource(coin, coinBalance, irregularity)
                    if (action) actions.push(action)
                }
            }

            // if debug mode
            log.info(tag, coin + ' actions: ', JSON.stringify(actions))
            let chosenActions = await smart_action_filter(actions, coin)
            log.info(tag, coin + ' chosen actions: ', JSON.stringify(chosenActions))

            if (chosenActions) {
                // for each chosen
                for (let j = 0; j < chosenActions.length; j++) {
                    let chosen = chosenActions[j]
                    let actionIdChosen = Object.keys(chosen)[0]
                    let actionString = chosen[actionIdChosen].coin + ' ' + parseInt(chosen[actionIdChosen].amount) + ' ' + chosen[actionIdChosen].from + ' ' + chosen[actionIdChosen].to
                    let amount = parseInt(chosen[actionIdChosen].amount)

                    log.debug(tag, coin + 'chosen actionString: ', actionString)

                    let maxSend = await redBack.get('rules:maxSend:' + coin)
                    let minSend = await redBack.get('rules:minSend:' + coin)
                    if (!maxSend) maxSend = 9000000 // max doge send
                    if (!minSend) minSend = 1 // never send 0

                    if (maxSend >= amount && amount > minSend) {
                        // add chosen to final
                        actionsFinal[actionIdChosen] = actionString
                    } else if (maxSend < amount) {
                        // adjust to maxsend
                        actionString = chosen[actionIdChosen].coin + ' ' + parseInt(maxSend) + ' ' + chosen[actionIdChosen].from + ' ' + chosen[actionIdChosen].to

                        actionsFinal[actionIdChosen] = actionString
                    }
                }
            } else {
                log.debug(tag, ' Smart filter failed to find option!@! ')
            }
        }

        let output = {}
        output.actions = actionsFinal
        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const autonomousOff = function () {
	if (!slackNerf) views.displayString('I will not longer execute acctions autonomously!')
    autonomous = false
}

const autonomousOn = function () {
    autonomous = true
}

const irregularities_by_coin = async function (analysis) {
    const tag = TAG + ' | get_position | '
    const debug = false
    const debug1 = false
    try {
        // get balances object from redis
        const position = await balances.byCoin()
        if (debug1) console.log(tag, 'balancesByCoin: ', position)
        const irregularitiesByCoin = {}
        // iterate over and summarize by coin
        for (let i = 0; i < analysis.length; i++) {
            // each coin has an array
            if (!irregularitiesByCoin[analysis[i].coin]) irregularitiesByCoin[analysis[i].coin] = []
            irregularitiesByCoin[analysis[i].coin].push(analysis[i])
        }
        log.debug(tag, 'irregularitiesByCoin: ', irregularitiesByCoin)
        return irregularitiesByCoin
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
