/**
 * Created by highlander on 7/6/17.
 */

const when = require('when')
const fs = require('fs')
const monk = require('monk')
const json2csv = require('json2csv')
const SlackUpload = require('node-slack-upload')

const config = require('../config')
const slackUp = new SlackUpload(config.SLACK_CONFIG.token)

const db = monk(config.MONGO_URI)
const balancesH = db.get('asynbalances')
const actionsH = db.get('actions')
const reportsH = db.get('reports')

// ME REST api
// let me = require("./uwallet.js")
let coins = require('./coins.js')
let views = require('./views.js')

// get exchanges
const exchanges = {}
exchanges.kraken = require('./../exchanges/kraken-client.js')
exchanges.bittrex = require('./../exchanges/bittrex-client.js')
// exchanges.poloniex = require('./../exchanges/poloniex-client.js')
exchanges.bitfinex = require('./../exchanges/bitfinex-client.js')

const redBack = require('./redis.js')

let TAG = ' | reports | '
module.exports = {
    // read all pending
    reportByDays: function (account, coin, days) {
        return get_report_by_days(account, coin, days)
    },
    reportByTimeframe: function (account, coin, start, end) {
        return get_report_by_timeframe(account, coin, start, end)
    },
}

/*************************************
 //primary
 //*************************************/

const get_report_by_days = async function (account, coin, days) {
    const tag = ' | run_test | '
    const debug = false
    const debug1 = false
    try {
        let stop = new Date().getTime()
        let start
        // if no time assume 1 day
        if (!days) {
            start = stop - 1000 * 60 * 60 * 24
        } else {
            start = stop - 1000 * 60 * 60 * 24 * days
        }

        if (debug) console.log(tag, 'start: ', start)
        if (debug) console.log(tag, 'stop: ', stop)

        let data = await build_report(account, coin, start, stop)

        return data
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

/*************************************
 //lib
 //*************************************/

const build_report = async function (account, coin, start, stop) {
    const tag = ' | run_test | '
    const debug = false
    const debug1 = false
    try {
        let mongoData = []
        // get mongo data
        let query = { $and: [{ coin: coin }, { time: { $gt: start } }] }
        //
        let mongoRaw = await reportsH.find(query)
        // filter by account
        for (let i = 0; i < mongoRaw.length; i++) {
            let entry = mongoRaw[i]
            if (entry.destination == account || entry.source == account) {
                mongoData.push(entry)
            }
        }

        // get exchange data
        start = start / 1000
        start = parseInt(start)

        stop = stop / 1000
        stop = parseInt(stop)

        let exchangeData = await exchanges[account].history(coin, start, stop)
        exchangeData = exchangeData.result

        if (debug) console.log(tag, 'exchangeData: ', exchangeData.length)
        if (debug) console.log(tag, 'mongoData: ', mongoData)

        // publish data as csv
        let result = await raw_to_csv_exchange(exchangeData, coin, start, stop)

        // analyize
        let finalData = compare_datasets(exchangeData, mongoData)
        return finalData
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

let raw_to_csv_exchange = async function () {
    try {
        //
        const fields = ['id', 'currency', 'method', 'type', 'amount', 'description', 'address', 'status', 'timestamp', 'timestamp_created', 'txid', 'fee']
        const result = json2csv({ data: data, fields: fields })

        // write to file
        const filename = 'report:' + new Date().getTime() + '.csv'
        await write_file(filename, result)

        // upload to slack
        await upload_to_slack(filename, config.SLACK_CONFIG.channel)

        return { success: true }
    } catch (e) {

    }
}

/*

        //bitfinex data
     {
         id: 2394838,
         currency: 'XMR',
         method: 'MONERO',
         type: 'WITHDRAWAL',
         amount: '74.0',
         description: '46yzCCD3Mza9tRj7aqPSaxVbbePtuAeKzf8Ky2eRtcXGcEgCg1iTBio6N4sPmznfgGEUGDoBz5CLxZ2XPTyZu1yoCAG7zt6, txid: a6ac69f1dce592d82dd01a4265adf371b0db6276b18c5e72a5c34aac69d6c325',
         address: '46yzCCD3Mza9tRj7aqPSaxVbbePtuAeKzf8Ky2eRtcXGcEgCg1iTBio6N4sPmznfgGEUGDoBz5CLxZ2XPTyZu1yoCAG7zt6',
         status: 'COMPLETED',
         timestamp: '1499341221.0',
         timestamp_created: '1499341141.0',
         txid: 'a6ac69f1dce592d82dd01a4265adf371b0db6276b18c5e72a5c34aac69d6c325',
         fee: '-0.01'
     },
     {
         id: 2391443,
         currency: 'XMR',
         method: 'MONERO',
         type: 'DEPOSIT',
         amount: '44.0',
         description: '09d1c56fb6bde3ceab2d62751556bdf66eda543a14d2cd6cda7b668cfb6c2de0',
         address: '5ffd3ad4fe7bee9b0a0fa52c5a873402848d1b114952fe79127d50c68efa4ef0',
         status: 'COMPLETED',
         timestamp: '1499316441.0',
         timestamp_created: '1499316440.0',
         txid: '09d1c56fb6bde3ceab2d62751556bdf66eda543a14d2cd6cda7b668cfb6c2de0',
         fee: '0.0'
     },

        //mongo data

         {
             _id: 595797f68ff6fe13af3a071c,
             actionId: 'ACSS79N',
             coin: 'xmr',
             amount: '510',
             source: 'hot',
             destination: 'bitfinex',
             irregularity: 'bitfinex Below min: 17779 actual: 17626.92042495',
             balanceSourceBefore: 6066,
             balanceDestinationBefore: 17626,
             balanceSourceAfter: 5556,
             balanceDestinationAfter: 18136,
             percentTargetSource: '20',
             percentTargetDestination: '64',
             txid: '{"succcess":true,"txid":"53df6a83e7eca6e2e37259dc003b6516bf8ad61058aa7a6d4ad44694185946f8"}',
             time: 1498912758473,
             date: 2017-07-01T12:39:18.473Z
          },
         {
             _id: 595799288ff6fe13af3a073a,
             actionId: 'KE9TC2A',
             coin: 'xmr',
             amount: '113',
             source: 'poloniex',
             destination: 'hot',
             irregularity: 'poloniex above Maximum: 4542 actual: 4655.52604530',
             balanceSourceBefore: 4655,
             balanceDestinationBefore: 5505,
             balanceSourceAfter: 4542,
             balanceDestinationAfter: 5618,
             percentTargetSource: '16',
             percentTargetDestination: '20',
             txid: '{"response":"Withdrew 113.00000000 XMR."}',
             time: 1498913064780,
             date: 2017-07-01T12:44:24.780Z
         },
         {
             _id: 5957a4e78ff6fe13af3a0864,
             actionId: 'TOG2N26',
             coin: 'xmr',
             amount: '653',
             source: 'hot',
             destination: 'bitfinex',
             irregularity: 'bitfinex Below min: 15372 actual: 14511.28570651',
             balanceSourceBefore: 5456,
             balanceDestinationBefore: 14511,
             balanceSourceAfter: 4803,
             balanceDestinationAfter: 15164,
             percentTargetSource: '20',
             percentTargetDestination: '64',
             txid: '{"succcess":true,"txid":"354bece07b6e32324bc0ff77a638f780aa7cc54d866291ca2a3727b3206b073e"}',
             time: 1498916071061,
             date: 2017-07-01T13:34:31.061Z
         },

 */

const compare_datasets = async function (exchangeData, mongoData) {
    const tag = ' | run_test | '
    const debug = false
    const debug1 = false
    try {
        let finalReport = {}
        finalReport.complete = []
        finalReport.incomplete = []
        let withdrawalIdsAsym = []
        let withdrawalIdsExchange = []
        let exchangeHistory = []
        let asymHistory = []
        let txidsAsym = []
        let txidsExchange = []
        let sumDepositsExchange = 0
        let sumWithdrawalsExchange = 0
        let sumDepositsAsym = 0
        let sumWithdrawalsAsym = 0
        let exchangeTxidIndex = {}
        let exchangeIdIndex = {}

        if (debug) console.log(tag, 'exchangeData: ', exchangeData.length)
        if (debug) console.log(tag, 'mongoData: ', mongoData.length)

        // time withdrawal/deposit amount

        // iterate over mongo data
        for (let i = 0; i < mongoData.length; i++) {
            let entry = mongoData[i]
            let event = {}
            event.time = entry.time
            if (entry.destination == 'bitfinex') {
                event.type = 'deposit'
                let txidRaw = entry.txid
                txidRaw = JSON.parse(txidRaw)
                let txid = txidRaw.txid
                event.txid = txid
                txidsAsym.push(txid)
                sumDepositsAsym = sumDepositsAsym + parseInt(entry.amount)
            } else {
                event.type = 'withdrawal'
                sumWithdrawalsAsym = sumWithdrawalsAsym + parseInt(entry.amount)
                let txidRaw = entry.txid
                txidRaw = JSON.parse(txidRaw)
                let id = txidRaw.withdrawal_id
                event.id = id
                withdrawalIdsAsym.push(id)
            }
            event.amount = entry.amount
            // find exchange data
            asymHistory.push(event)
        }

        // iterate over mongo data
        for (let i = 0; i < exchangeData.length; i++) {
            let entry = exchangeData[i]
            let event = {}
            event.amount = entry.amount
            event.time = entry.timestamp_created
            if (entry.type == 'DEPOSIT') {
                event.type = 'deposit'
                txidsExchange.push(entry.txid)
                sumDepositsExchange = sumDepositsExchange + parseInt(entry.amount)
                exchangeTxidIndex[entry.txid] = entry
            }
            if (entry.type == 'WITHDRAWAL') {
                event.type = 'withdrawal'
                event.id = entry.id
                event.txid = entry.id
                txidsExchange.push(entry.txid)
                sumWithdrawalsExchange = sumWithdrawalsExchange + parseInt(entry.amount)
                withdrawalIdsExchange.push(entry.id)
                exchangeIdIndex[entry.id] = entry
            }
            // find exchange data
            exchangeHistory.push(event)
        }
        if (debug) console.log(tag, 'exchangeHistory: ', exchangeHistory)
        if (debug) console.log(tag, 'asymHistory: ', asymHistory)
        if (debug) console.log(tag, 'sumWithdrawalsExchange: ', sumWithdrawalsExchange)
        if (debug) console.log(tag, 'sumDepositsExchange: ', sumDepositsExchange)
        if (debug) console.log(tag, 'sumDepositsAsym: ', sumDepositsAsym)
        if (debug) console.log(tag, 'sumWithdrawalsAsym: ', sumWithdrawalsAsym)
        if (debug) console.log(tag, 'withdrawalIdsExchange: ', withdrawalIdsExchange.length)
        if (debug) console.log(tag, 'withdrawalIdsAsym: ', withdrawalIdsAsym.length)
        if (debug) console.log(tag, 'txidsExchange: ', txidsExchange)
        if (debug) console.log(tag, 'txidsAsym: ', txidsAsym)
        if (debug) console.log(tag, 'txidsExchange: ', txidsExchange.length)
        if (debug) console.log(tag, 'txidsAsym: ', txidsAsym.length)

        finalReport.sumDepositsExchange = sumDepositsExchange
        finalReport.sumWithdrawalsExchange = sumWithdrawalsExchange
        finalReport.sumDepositsAsym = sumDepositsAsym
        finalReport.sumWithdrawalsAsym = sumWithdrawalsAsym

        //
        let diff1 = arr_diff(withdrawalIdsExchange, withdrawalIdsAsym)
        if (debug) console.log(tag, 'diff1: ', diff1)

        // go over asym history
        for (let i = 0; i < asymHistory.length; i++) {
            // goes each entry have exchange data
            let entry = asymHistory[i]
            // if txid match on txid
            if (entry.txid) {
                let exchangeInfo = exchangeTxidIndex[entry.txid]
                if (exchangeInfo) {
                    let event = {}
                    event.complete = true
                    event.mongo = entry
                    event.exchange = exchangeInfo

                    // get coin data
                    await pause(1)
                    event.coin = await coins.getTransaction(entry.txid, 'xmr')

                    finalReport.complete.push(event)
                } else {
                    let event = {}
                    event.complete = false
                    event.mongo = entry
                    event.exchange = 'Not Found!'
                    finalReport.incomplete.push(event)
                }
            } else if (entry.id) {
                let exchangeInfo = exchangeIdIndex[entry.id]
                if (exchangeInfo) {
                    let event = {}
                    event.complete = true
                    event.mongo = entry
                    event.exchange = exchangeInfo

                    // get coin data
                    event.coin = await coins.getTransaction(exchangeInfo.txid, 'xmr')

                    finalReport.complete.push(event)
                } else {
                    let event = {}
                    event.complete = false
                    event.mongo = entry
                    event.exchange = 'Not Found!'
                    finalReport.incomplete.push(event)
                }
            }
        }

        if (debug) console.log(tag, 'exchangeIdIndex: ', exchangeIdIndex)
        if (debug) console.log(tag, 'exchangeTxidIndex: ', exchangeTxidIndex)
        if (debug) console.log(tag, 'finalReport: ', finalReport)
        if (debug) console.log(tag, 'finalReport: ', finalReport.complete)

        // analyize extra exchange data

        // analyize missing exchange data

        return finalReport
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

function arr_diff (a1, a2) {
    let a = [], diff = []

    for (var i = 0; i < a1.length; i++) {
        a[a1[i]] = true
    }

    for (var i = 0; i < a2.length; i++) {
        if (a[a2[i]]) {
            delete a[a2[i]]
        } else {
            a[a2[i]] = true
        }
    }

    for (let k in a) {
        diff.push(k)
    }

    return diff
};

const write_file = function (filename, data) {
    const d = when.defer()

    fs.writeFile(filename, data, function (err) {
        if (err) throw err

        d.resolve(true)
    })
    return d.promise
}

const upload_to_slack = function (filename, channel) {
    const d = when.defer()

    slackUp.uploadFile({
        file: fs.createReadStream(filename),
        filetype: 'csv',
        title: filename,
        initialComment: filename,
        channels: channel
    }, function (err, data) {
        if (err) {
            console.error(err)
            d.resolve(false)
        } else {
            console.log('Uploaded file details: ', data)
            d.resolve(true)
        }
    })

    return d.promise
}
