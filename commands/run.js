/**
 * Created by highlander on 5/30/17.
 */

let TAG = ' | run | '
// const ab  = require('./../modules/auto_balance.js')
const balance = require('./../modules/auto-balance.js')
const alert = require('./../modules/alert.js')
const analyze = require('./../modules/analyzer.js')
const settings = require('./../modules/settings.js')

const config = require('../config')
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

let isRunning = false
let isRR = false

module.exports = {

    run: function (interval) {
        return "I dont do this anymore"
    	//return runtime(interval)
    },
    runOnce: function () {
        return balance.run()
    },
    bitcoinRR: function () {
        return bitcoin_round_robin()
    }
}

/********************************************************
 //    Primary
 //********************************************************/

// const start_bitcoin_round_robin = async function() {
//     const tag = TAG+" | start_bitcoin_round_robin | "
//     const debug = true
//     try {
//         if(!isRR){
//             isRR = true
//             setInterval(bitcoin_round_robin, 60* 5 * 1000)
//
//             return bitcoin_round_robin()
//         } else {
//             return "already running bitcoinRR bro! leave it."
//         }
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }

const litecoin_round_robin = async function () {
    const tag = TAG + ' | bitcoin_round_robin | '
    const debug = true
    try {
        // get all balances
        let balancesLTC = await redBack.hgetall('ltcBalances')
        if (debug) console.log(tag, 'balancesLTC', balancesLTC)
        let servers = Object.keys(balancesLTC)
        let serverArray = []
        for (let i = 0; i < servers.length; i++) {
            let entry = {}
            entry.server = servers[i]
            entry.balance = balancesLTC[servers[i]]
            serverArray.push(entry)
        }
        if (debug) console.log(tag, 'serverArray')

        // sort by highest
        const sortedSet = serverArray.sort(function (a, b) { return parseFloat(a.balance) - parseFloat(b.balance) })
        if (debug) console.log(tag, 'sortedSet: ', sortedSet)

        // select highest as main
        let selection = sortedSet[sortedSet.length - 1]
        if (debug) console.log(tag, 'selection: ', selection)

        // save selection to preference
        let nodeName = selection.server.replace('litecoin', 'ltc')
        if (debug) console.log(tag, 'nodeName: ', nodeName)
        redBack.set('ltcMaster', nodeName)

        return selection
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const bitcoin_round_robin = async function () {
    const tag = TAG + ' | bitcoin_round_robin | '
    const debug = true
    try {
        // get all balances
        let balancesBTC = await redBack.hgetall('btcBalances')
        if (debug) console.log(tag, 'balancesBTC')
        let servers = Object.keys(balancesBTC)
        let serverArray = []
        for (let i = 0; i < servers.length; i++) {
            let entry = {}
            entry.server = servers[i]
            entry.balance = balancesBTC[servers[i]]
            serverArray.push(entry)
        }
        if (debug) console.log(tag, 'serverArray')

        // sort by highest
        const sortedSet = serverArray.sort(function (a, b) { return parseFloat(a.balance) - parseFloat(b.balance) })
        if (debug) console.log(tag, 'sortedSet: ', sortedSet)

        // select highest as main
        let selection = sortedSet[sortedSet.length - 1]
        if (debug) console.log(tag, 'selection: ', selection)

        // save selection to preference
        let nodeName = selection.server.replace('bitcoin', 'btc')
        if (debug) console.log(tag, 'nodeName: ', nodeName)
        redBack.set('btcMaster', nodeName)
        // setInterval(bitcoin_round_robin, 60* 5 * 1000)

        return selection
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

// throw events
const runtime = async function (intervial) {
    const tag = TAG + ' | run_balance | '
    const debug = true
    try {
        // if(intervial) intervial = parseInt(intervial)
        // if(!intervial) intervial = 5 * 60 //seconds
        // balance.run()
        // setInterval(balance.run,intervial * 1000)
        // setInterval(settings.retarget,intervial * 1000)

        if (!isRunning) {
            if (intervial) intervial = parseInt(intervial)
            if (!intervial) intervial = 25 * 60 // seconds
            balance.run()
            setInterval(balance.run, intervial * 1000)
            setInterval(settings.retarget, intervial * 1000)

            // RR's
            bitcoin_round_robin()
            litecoin_round_robin()
            setInterval(bitcoin_round_robin, 60 * 25 * 1000)
            setInterval(litecoin_round_robin, 60 * 25 * 1000)

            // every 90minutes reset pending //TODO PENDING HACK< DONT DO THIS
            let checkPending = function () {
                // analyze.pending()
                redBack.del('pendingTx')
            }

            isRunning = true
            setInterval(checkPending, 90 * 60 * 1000)

            return 'fine! ill start running now!'
        } else {
            return 'already running bro!!! '
        }

        if (!isRunning) {
            isRunning = true
	    if (!intervial) intervial = 25 * 60 // seconds
            balance.run()
            setInterval(balance.run, intervial * 1000)
            setInterval(settings.retarget, intervial * 1000)

            setInterval(checkPending, 90 * 60 * 1000)
	    return 'alright im running now, yay...'
        } else {
            return 'already running bro!!! '
        }
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

// alert if not running
let checkRunning = function () {
    if (!isRunning) {
       // alert.onCall(' Asym is STILL offline!! Why am I turned off? turn me back on!! I have been off for 15 minutes')
    }
}

if (config.setting === 'prod') {
    // don't alert of staging
    setInterval(checkRunning, 15 * 60 * 1000)
}
