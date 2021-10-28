/**
 * Created by highlander on 6/14/17.
 */

const when = require('when')

const Redis = require('then-redis')
const fs = require('fs')
const config = require('../config')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const monk = require('monk')
const db = monk(config.MONGO_URI)
const tx = db.get('tx')
const conduit = db.get('conduit')
const pendingTx = db.get('pendingTx')
const thresholds = db.get('thresholds')
const thresholdTx = db.get('thresholdTX')
const storageXENG = db.get('storageXENG')
const rippleAccounts = db.get('rippleAccounts')
const rippleTx = db.get('rippleTx')
const affiliateInfo = db.get('affiliateInfo')
const orders = db.get('orders')

const SlackUpload = require('node-slack-upload')
const slackUp = new SlackUpload(config.SLACK_CONFIG.token)

const run = async function (days) {
    const tag = ' | find_order | '
    const debug = true
    const debug1 = false
    try {
        let writeStream = fs.createWriteStream('./duplicates')
        // get current date
        let timeNow = new Date().getTime()
        if (debug) console.log(tag, 'timeNow: ', timeNow)
        let finalCount = 0
        // get date 10 days ago
        let d = new Date()
        d.setMonth(d.getDay() - 10)
        d.setHours(0, 0, 0)
        d.setMilliseconds(0)
        let timeStart = d.getTime()
        // divide into 10 chunks
        if (debug) console.log(tag, 'timeStart: ', timeStart)
        // perform chunks

        let timeTotal = timeNow - timeStart
        if (debug) console.log(tag, 'timeTotal: ', timeTotal)
        let intervial = timeTotal / 10
        if (debug) console.log(tag, 'intervial: ', intervial)

        let intervials = []
        for (let i = 0; i < 10; i++) {
            let timeEnd = timeNow - intervial
            intervials.push([timeNow, timeEnd])
            timeNow = timeEnd
        }
        if (debug) console.log(tag, 'intervials: ', intervials)

        for (let i = 0; i < intervials.length; i++) {
            let timeIntervial = intervials[i]

            let timeStart = parseInt(timeIntervial[0])
            let timeEnd = parseInt(timeIntervial[1])
            if (debug) console.log(tag, 'timeStart: ', timeStart)
            if (debug) console.log(tag, 'timeEnd: ', timeEnd)

            // get all pending eth inputs sort time limit 1000
            let query = {}
            // query["pair"]={$regex : "ETH_*."}
            // let options = {limit: 100000, sort: {time: -1}};
            query = { $and: [{ pair: { $regex: 'ETH_*.' } }, { time: { $gt: timeEnd } }, { time: { $lt: timeStart } }] }
            // query = {pair:{$regex : "ETH_*."}},{time:{$gt: timeEnd}},{time:{$lt:timeStart}}
            console.log(tag, 'query: ', query)

            const results = await pendingTx.find(query)
            if (debug) console.log(tag, '*** results: ', results.length)

            // check conduits
            for (let i = 0; i < results.length; i++) {
                let result = results[i]
                let query2 = {}
                query2['deposit'] = result.deposit
                // lookup address in conduits
                let conduitInfo = await conduit.find(query2)
                if (conduitInfo.length > 0) {
                    // nerf BOTH
                    let results1 = await conduit.update({ deposit: result.deposit }, { $set: { nerf: true } })
                    pause(100)
                    console.log(tag, 'results: ', results1)
                    let results2 = await pendingTx.update({ deposit: result.deposit }, { $set: { nerf: true } })
                    console.log(tag, 'results2: ', results2)

                    finalCount = finalCount + 1
                    //
                    // writeStream.write(JSON.stringify(conduitInfo)+',\n');
                    if (debug1) console.log(tag, 'conduitInfo: ', conduitInfo)
                    console.log(tag, 'finalCount: ', finalCount)
                    console.log('WINNING!!!! errr, I mean shit, double found!')
                }
            }
            await pause(100)
        }
        console.log('DONE! final: ', finalCount)
        return true
    } catch (e) {
        console.error(tag, 'e:', e)
        throw 'ERROR:100 Failed to find simple! :' + e
    }
}

const pause = function (length) {
    const d = when.defer()
    const done = function () { d.resolve(true) }
    setTimeout(done, length)
    return d.promise
}

run(10)
