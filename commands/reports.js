/**
 * Created by highlander on 5/30/17.
 */
const when = require('when')
const fs = require('fs')
const monk = require('monk')
const json2csv = require('json2csv')
const config = require('../config')
const db = monk(config.MONGO_URI)
const balancesH = db.get('asynbalances')
const actionsH = db.get('actions')
const reportsH = db.get('reports')
const SlackUpload = require('node-slack-upload')
const slackUp = new SlackUpload(config.SLACK_CONFIG.token)

let TAG = ' | reports | '
const exchanges = {}
exchanges.kraken = require('./../exchanges/kraken-client.js')
exchanges.bittrex = require('./../exchanges/bittrex-client.js')
// exchanges.poloniex = require('./../exchanges/poloniex-client.js')
exchanges.bitfinex = require('./../exchanges/bitfinex-client.js')

let exchangeNames = Object.keys(exchanges)
let dbs = {}
let exchange = 'bittrex'
dbs['internalTransactions'] = db.get('internalTransactions')
dbs[exchange + 'Trades'] = db.get(exchange + 'Trades')
dbs[exchange + 'Withdrawals'] = db.get(exchange + 'Withdrawals')
dbs[exchange + 'Deposits'] = db.get(exchange + 'Deposits')
// indexes
dbs['internalTransactions'].ensureIndex({ txid: 1 }, { unique: true })
dbs[exchange + 'Trades'].ensureIndex({ OrderUuid: 1 }, { unique: true })
dbs[exchange + 'Withdrawals'].ensureIndex({ id: 1 }, { unique: true })
dbs[exchange + 'Deposits'].ensureIndex({ txid: 1 }, { unique: true })

exchange = 'kraken'
dbs[exchange + 'Trades'] = db.get(exchange + 'Trades')
dbs[exchange + 'Withdrawals'] = db.get(exchange + 'Withdrawals')
dbs[exchange + 'Deposits'] = db.get(exchange + 'Deposits')
// indexes
dbs[exchange + 'Trades'].ensureIndex({ ordertxid: 1 }, { unique: true })
dbs[exchange + 'Withdrawals'].ensureIndex({ id: 1 }, { unique: true })
dbs[exchange + 'Deposits'].ensureIndex({ txid: 1 }, { unique: true })

// exchange = 'poloniex'
// dbs[exchange + 'Trades'] = db.get(exchange + 'Trades')
// dbs[exchange + 'Withdrawals'] = db.get(exchange + 'Withdrawals')
// dbs[exchange + 'Deposits'] = db.get(exchange + 'Deposits')
// indexes
dbs[exchange + 'Trades'].ensureIndex({ globalTradeID: 1 }, { unique: true })
dbs[exchange + 'Withdrawals'].ensureIndex({ withdrawalNumber: 1 }, { unique: true })
dbs[exchange + 'Deposits'].ensureIndex({ txid: 1 }, { unique: true })

exchange = 'bitfinex'
dbs[exchange + 'Trades'] = db.get(exchange + 'Trades')
dbs[exchange + 'Withdrawals'] = db.get(exchange + 'Withdrawals')
dbs[exchange + 'Deposits'] = db.get(exchange + 'Deposits')
// indexes
dbs[exchange + 'Trades'].ensureIndex({ globalTradeID: 1 }, { unique: true })
dbs[exchange + 'Withdrawals'].ensureIndex({ id: 1 }, { unique: true })
dbs[exchange + 'Deposits'].ensureIndex({ txid: 1 }, { unique: true })

// dbs["internalTransactions"] = db.get("internalTransactions");
// for (let i = 0; i < exchangeNames.length; i++) {
//     let exchange = exchangeNames[i]
//     dbs[exchange+"Trades"] = db.get(exchange+"Trades");
//     // dbs[exchange+"Transfers"] = db.get(exchange+"Transfers");
//     // dbs[exchange+"Trades"].ensureIndex({id: 1}, {unique: true})
//     // dbs[exchange+"Transfers"].ensureIndex({id: 1}, {unique: true})
//
//     dbs[exchange+"Withdrawals"] = db.get(exchange+"Withdrawals");
//     dbs[exchange+"Deposits"] = db.get(exchange+"Deposits");
//     // dbs[exchange+"Trades"].createIndex({id: 1}, {unique: true})     //if mongo version > 3
//     // dbs[exchange+"Transfers"].createIndex({id: 1}, {unique: true})  //if mongo version > 3
// }

const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const audit = require('../modules/audit.js')
const report = require('../modules/report.js')
module.exports = {

    // time tools
    timeNow: function () {
        return new Date().getTime().toString()
    },

    dateToTimestamp: function (month, date, year) {
        let input = month + ' ' + date + ' ' + year
        let output = new Date(input).getTime()
        return output.toString()
    },

    timestampToDate: function (timestamp) {
        timestamp = parseInt(timestamp)
        let output = new Date(timestamp).toString()
        return output.toString()
    },

    transferReportAudit: async function (exchange, start, end, interval) {
        let debug = true
        let tag = TAG + ' | transferReportQuick | '
        try {
            let output = { exchange, start, end, interval }

            if (!interval) interval = 1
            // get data from exchange
            let exchangeData = await exchanges[exchange].transferHistoryRip(start, end, 1)
            exchangeData = exchangeData.transfers
            // if(debug) console.log(tag,"exchangeData: ",exchangeData)
            if (debug) console.log(tag, 'exchangeData: ', exchangeData.length)
            output.entriesExchange = exchangeData.length

            // get data from mongo
            end = end / 1000
            start = start / 1000
            let query = {}
            query['timestamp'] = { $gte: start, $lte: end }
            query['exchange'] = exchange
            if (debug) console.log(tag, 'query: ', query)
            let mongoData = await dbs['internalTransactions'].find(query)
            // filter by exchange
            if (debug) console.log(tag, 'mongoData: ', mongoData)
            if (debug) console.log(tag, 'mongoData: ', mongoData.length)
            output.entriesMongo = mongoData.length

            // is data complete?
            if (output.entriesMongo === output.entriesExchange) {
                output.complete = true
            } else {
                output.complete = false
            }

            // if(mongoData.length > 0){
            //     await raw_to_csv(mongoData,exchange+"(archive):"+coin+":"+start+":"+end)
            //
            //     if(!output.complete) await raw_to_csv(exchangeData,exchange+"(raw):"+coin+":"+start+":"+end)
            //     return "done";
            // } else {
            //     return "no records found~!"
            // }

            console.log('********************* output: ', output)

            await raw_to_csv(mongoData, exchange + ':transfers:(archive):' + start + ':' + end)

            await raw_to_csv(exchangeData, exchange + ':transfers:(raw):' + start + ':' + end)

            return output
        } catch (e) {
            console.error(tag, 'error: ', e)
        }
    },

    tradeReportAudit: async function (exchange, start, end, interval) {
        let debug = true
        let tag = TAG + ' | transferReportQuick | '
        try {
            let output = { exchange, start, end, interval }

            if (!interval) interval = 1
            // get data from exchange
            let exchangeData = await exchanges[exchange].tradeHistoryRip(start, end, interval)
            exchangeData = exchangeData.trades
            // if(debug) console.log(tag,"exchangeData: ",exchangeData)
            if (debug) console.log(tag, 'exchangeData: ', exchangeData.length)
            output.entriesExchange = exchangeData.length

            // get data from mongo
            end = end / 1000
            start = start / 1000
            let query = {}
            query['timestamp'] = { $gte: start, $lte: end }
            if (debug) console.log(tag, 'query: ', query)
            let mongoData = await dbs[exchange + 'Trades'].find(query)
            // filter by exchange
            if (debug) console.log(tag, 'mongoData: ', mongoData)
            if (debug) console.log(tag, 'mongoData: ', mongoData.length)
            output.entriesMongo = mongoData.length

            // is data complete?
            if (output.entriesMongo === output.entriesExchange) {
                output.complete = true
            } else {
                output.complete = false
            }

            // if(mongoData.length > 0){
            //     await raw_to_csv(mongoData,exchange+"(archive):"+coin+":"+start+":"+end)
            //
            //     if(!output.complete) await raw_to_csv(exchangeData,exchange+"(raw):"+coin+":"+start+":"+end)
            //     return "done";
            // } else {
            //     return "no records found~!"
            // }

            console.log('********************* output: ', output)

            await raw_to_csv(mongoData, exchange + ':trades:(archive):' + start + ':' + end)

            await raw_to_csv(exchangeData, exchange + ':trades:(raw):' + start + ':' + end)

            return output
        } catch (e) {
            console.error(tag, 'error: ', e)
        }
    },

    // transferReportAll: async function (start,end)
    // {
    //     let debug = true
    //     let tag = TAG+" | transferReportAll | "
    //     try{
    //         end = end/1000
    //         start = start/1000
    //         end = parseInt(end)
    //         start = parseInt(start)
    //
    //         //for each exchange
    //         let results = {}
    //         for (let i = 0; i < exchangeNames.length; i++) {
    //             let exchange = exchangeNames[i]
    //
    //             //debug
    //             let entryCount = await dbs[exchange + "Withdrawals"].count()
    //             if(debug) console.log(tag,exchange+" entryCount: ",entryCount)
    //
    //             results[exchange] = {}
    //             if(debug) console.log(tag,"exchange: ",exchange)
    //             //
    //             let query = {}
    //             //query['timestamp'] = {$gte: start, $lte: end}
    //             if(debug) console.log(tag,"query: ",query)
    //             let mongoData = await dbs[exchange + "Withdrawals"].find(query)
    //             if(debug) console.log(tag,"mongoData: ",mongoData)
    //
    //             if(mongoData.length > 0){
    //                 await raw_to_csv(mongoData,exchange+":Withdrawals:"+start+":"+end)
    //                 results[exchange].withdrawals = true
    //             } else {
    //                 results[exchange].withdrawals = "None found!"
    //             }
    //
    //             mongoData = await dbs[exchange + "Deposits"].find(query)
    //             if(debug) console.log(tag,"mongoData: ",mongoData)
    //             if(mongoData.length > 0){
    //                 await raw_to_csv(mongoData,exchange+":Deposits:"+start+":"+end)
    //                 results[exchange].Deposits = true
    //             }else {
    //                 results[exchange].Deposits = "None found!"
    //             }
    //
    //
    //         }
    //
    //         return results
    //     }catch(e){
    //         console.error(tag,"e: ",e)
    //     }
    // },
    //
    //
    // transferReportAllAudit: async function (start,end)
    // {
    //     let debug = true
    //     let tag = TAG+" | transferReportAll | "
    //     try{
    //         end = end/1000
    //         start = start/1000
    //         end = parseInt(end)
    //         start = parseInt(start)
    //
    //         //for each exchange
    //         let results = {}
    //         for (let i = 0; i < exchangeNames.length; i++) {
    //             let exchange = exchangeNames[i]
    //
    //             //count all in mongo on timeline
    //             let entryCount = await dbs[exchange + "Withdrawals"].count()
    //             if(debug) console.log(tag,"entry: ",entryCount)
    //             //query exchange
    //
    //             //look for differences in count
    //
    //             //debug
    //             // let entryCount = await dbs[exchange + "Withdrawals"].count()
    //             // if(debug) console.log(tag,exchange+" entryCount: ",entryCount)
    //             //
    //             // results[exchange] = {}
    //             // if(debug) console.log(tag,"exchange: ",exchange)
    //             // //
    //             // let query = {}
    //             // //query['timestamp'] = {$gte: start, $lte: end}
    //             // if(debug) console.log(tag,"query: ",query)
    //             // let mongoData = await dbs[exchange + "Withdrawals"].find(query)
    //             // if(debug) console.log(tag,"mongoData: ",mongoData)
    //             //
    //             // if(mongoData.length > 0){
    //             //     await raw_to_csv(mongoData,exchange+":Withdrawals:"+start+":"+end)
    //             //     results[exchange].withdrawals = true
    //             // } else {
    //             //     results[exchange].withdrawals = "None found!"
    //             // }
    //             //
    //             // mongoData = await dbs[exchange + "Deposits"].find(query)
    //             // if(debug) console.log(tag,"mongoData: ",mongoData)
    //             // if(mongoData.length > 0){
    //             //     await raw_to_csv(mongoData,exchange+":Deposits:"+start+":"+end)
    //             //     results[exchange].Deposits = true
    //             // }else {
    //             //     results[exchange].Deposits = "None found!"
    //             // }
    //
    //
    //         }
    //
    //         return results
    //     }catch(e){
    //         console.error(tag,"e: ",e)
    //     }
    // },
    //
    //
    // transferReport: async function (exchange,start,end,coin)
    // {
    //     let debug = true
    //     let tag = TAG+" | transferReportQuick | "
    //     try{
    //         end = end/1000
    //         start = start/1000
    //         let query = {}
    //         query['timestamp'] = {$gte: start, $lte: end}
    //         if(coin) query['coin'] = coin.toUpperCase()
    //         if(debug) console.log(tag,"query: ",query)
    //         let mongoData = await dbs[exchange + "Transfers"].find(query)
    //         if(debug) console.log(tag,"mongoData: ",mongoData)
    //
    //         if(mongoData.length > 0){
    //             await raw_to_csv(mongoData,exchange+":"+coin+":"+start+":"+end)
    //             return "done";
    //         } else {
    //             return "no records found~!"
    //         }
    //
    //     }catch(e){
    //         console.error()
    //     }
    // },
    //
    // tradeReport: async function (exchange,start,end,coin)
    // {
    //     let debug = true
    //     let tag = TAG+" | transferReportQuick | "
    //     try{
    //         end = end/1000
    //         start = start/1000
    //         let query = {}
    //         query['timestamp'] = {$gte: start, $lte: end}
    //         if(coin) query['coin'] = coin.toUpperCase()
    //         if(debug) console.log(tag,"query: ",query)
    //         let mongoData = await dbs[exchange + "Trades"].find(query)
    //         if(debug) console.log(tag,"mongoData: ",mongoData)
    //
    //         if(mongoData.length > 0){
    //             await raw_to_csv(mongoData,exchange+":"+coin+":"+start+":"+end)
    //             return "done";
    //         } else {
    //             return "no records found~!"
    //         }
    //
    //     }catch(e){
    //         console.error()
    //     }
    // },
    //
    // makeDetailedReport: async function (start,end,apiKey)
    // {
    //     let debug = true
    //     let tag = TAG+" | transferReportQuick | "
    //     try{
    //         end = end/1000
    //         start = start/1000
    //         let query = {}
    //         query['timestamp'] = {$gte: start, $lte: end}
    //         if(coin) query['coin'] = coin.toUpperCase()
    //         if(debug) console.log(tag,"query: ",query)
    //         let mongoData = await dbs[exchange + "Trades"].find(query)
    //         if(debug) console.log(tag,"mongoData: ",mongoData)
    //
    //         if(mongoData.length > 0){
    //             await raw_to_csv(mongoData,exchange+":"+coin+":"+start+":"+end)
    //             return "done";
    //         } else {
    //             return "no records found~!"
    //         }
    //
    //     }catch(e){
    //         console.error()
    //     }
    // },

    // tradeReport: function (start,end,intervial)
    // {
    //     return transfer_history_rip(start,end,intervial);
    // },
    //
    // transferReport: function (start,end,intervial)
    // {
    //     return transfer_history_rip(start,end,intervial);
    // },

    report: function (start, end) {
        return build_report_csv(start, end)
    },
    //
    asymReport: function (start, end) {
        return build_report_csv(start, end)
    },
    //
    // reportByCoin: function (coin,days)
    // {
    //     return build_report_csv_by_day(coin,days);
    // },
    //
    // //transferHistory
    //
    // exchangeHistoryByDays: function (exchange,coin,days)
    // {
    //     if(exchange === "poloniex" || exchange === "bittrex" || exchange === "bitfinex" || exchange === "btce" || exchange === "kraken"){
    //         return get_report_by_days(exchange,coin,days)
    //     } else {
    //         return {error:"invalid exchange: "+account}
    //     }
    // },
    //
    // exchangeHistoryByTime: function (exchange,coin,start,end)
    // {
    //     if(exchange === "poloniex" || exchange === "bittrex" || exchange === "bitfinex" || exchange === "btce" || exchange === "kraken"){
    //         return build_report(exchange,start,end)
    //     } else {
    //         return {error:"invalid exchange: "+account}
    //     }
    // },
    //
    // tradeHistory: function (account,coin,start,stop)
    // {
    //     if(account === "poloniex" || account === "bittrex" || account === "bitfinex" || account === "btce" || account === "kraken"){
    //         return build_trade_report_of_exchange(account,coin,start,stop)
    //     } else {
    //         return {error:"invalid exchange: "+account}
    //     }
    // },
    //
    // audit: function (coin,days)
    // {
    //     return audit(coin,days)
    // },
    //
    // debug: function (actionId)
    // {
    //     return get_action_summary(actionId);
    // },
}

/*************************************************************
 //    trade reporting
 //*************************************************************/

/*************************************************************
 //    Transfer reporting
 //*************************************************************/

let digest_transfer_history = async function (dataChunk, coin, exchange) {
    let tag = TAG + ' | digest_transfer_history | '
    let debug = true
    try {
        if (debug) console.log(tag, 'dataChunk: ', dataChunk)
        if (debug) console.log(tag, 'coin: ', coin)
        if (debug) console.log(tag, 'exchange: ', exchange)

        for (let i = 0; i < dataChunk.length; i++) {
            let entry = dataChunk[i]
            if (debug) console.log(tag, 'id: ', entry.id)
            // save raw entry to db
            entry.timestamp = parseFloat(entry.timestamp)
            let success = await dbs[exchange + 'Transfers'].insert(entry)
            if (debug) console.log(tag, 'success: ', success)
        }
    } catch (e) {
        console.error(tag, 'error: ', e)
    }
}

let transfer_history_rip = async function (start, end, intervial) {
    let tag = TAG + ' | transfer_history_rip | '
    let debug = true
    try {
        let batch = await build_intervial_batch(start, end, intervial)
        if (debug) console.log(tag, 'batch: ', batch)
        // try first intervial
        // if limit, rebatch with higher interval
        delete exchanges['kraken']
        // for each exchange
        // let exchangeNames = Object.keys(exchanges)
        let exchangeNames = ['bittrex']

        // let coins = ['btc']
        let coins = await get_coins()

        for (let i = 0; i < exchangeNames.length; i++) {
            let exchange = exchangeNames[i]
            // for each batch chunk
            for (let j = 0; j < coins.length; j++) {
                let coin = coins[j]
                // for each coin
                for (let k = 0; k < batch.length; k++) {
                    let intervial = batch[k]
                    let dataChunk = await exchanges[exchange].transferHistory(coin, intervial[0], intervial[1])
                    if (debug) console.log(tag, 'dataChunk: ', dataChunk)

                    // digest data
                    let success = await digest_transfer_history(dataChunk, coin, exchange)
                    // pause
                }

                // for each coin make report
                start = start / 1000
                end = end / 1000

                if (debug) console.log(tag, 'time start: ', start)
                if (debug) console.log(tag, 'time end: ', end)
                let query = {}
                query['timestamp'] = { $gte: start, $lte: end }
                query['coin'] = 'BTC'
                if (debug) console.log(tag, 'query: ', query)
                let mongoData = await dbs[exchange + 'Transfers'].find(query)
                if (debug) console.log(tag, 'mongoData: ', mongoData)

                await raw_to_csv(mongoData, exchange + ':' + coin + ':' + start + ':' + end)
            }
        }

        console.log('******** DONE ***************')
    } catch (e) {
        console.error(tag, 'error: ', e)
    }
}

/*************************************************************
//    ASYM reporting
//*************************************************************/
const build_trade_report_of_exchange = async function (exchange, coin, start, stop) {
    const tag = ' | run_test | '
    const debug = true
    const debug1 = false
    try {
        // let stop = new Date().getTime()
        // let start
        // //if no time assume 1 day
        // start = stop - 1000 * 60 * 60 * 24
        //
        // //
        // //get exchange data
        // start = start/1000
        // start = parseInt(start)
        //
        // stop = stop/1000
        // stop = parseInt(stop)
        // if(debug) console.log(tag,"start: ",start)
        // if(debug) console.log(tag,"stop: ",stop)

        //
        let exchangeData = await exchanges[exchange].tradeHistory('BTC_' + coin.toUpperCase(), start, stop)
        if (debug1) console.log(tag, 'exchangeData: ', exchangeData)
        //
        exchangeData = exchangeData.result
        if (debug) console.log(tag, 'exchangeData: ', exchangeData.length)
        /*
             {
             globalTradeID: 189477052,
             tradeID: 11666230,
             date: '2017-07-12 21:21:23',
             type: 'sell',
             rate: '0.01655004',
             amount: '0.16239766',
             total: '0.00268768'
             },
         */

        const fields = ['globalTradeID', 'tradeID', 'date', 'type', 'rate', 'amount', 'total']

        const result = json2csv({ data: exchangeData, fields: fields })
        if (debug) console.log(tag, result)

        // write to file
        const filename = exchange + ':trades:report:' + start + ':' + stop
        await write_file(filename, result)

        // upload to slack
        await upload_to_slack(filename, config.slack.channel)

        return { success: true }
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

/*************************************************************
 //    SS reporting
 //*************************************************************/

const makeDetailedReport = async function (timeFrom, timeTo, apiPubKey) {
    let tag = ' | makeDetailedReport | '
    try {
        start = parseFloat(timeFrom)
        end = parseFloat(timeTo)

        let transactions
        let quick
        let precise
        if (apiPubKey) {
            transactions = await tx.find({ apiPubKey: apiPubKey, time: { $gt: start, $lt: end } })
            precise = await pendingTx.find({ apiPubKey: apiPubKey, preciseOrderCreationTime: { $gt: (start * 1000), $lt: (end * 1000) } })
            quick = await conduit.find({ apiPubKey: apiPubKey, timestamp: { $gt: (start * 1000).toString(), $lt: (end * 1000).toString() } })
        } else {
            transactions = await tx.find({ time: { $gt: start, $lt: end } })
            precise = await pendingTx.find({ preciseOrderCreationTime: { $gt: (start * 1000), $lt: (end * 1000) } })
            quick = await conduit.find({ timestamp: { $gt: (start * 1000).toString(), $lt: (end * 1000).toString() } })
        }

        let preciseMapped = {}
        let quickMapped = {}
        precise.map((tx) => { preciseMapped[tx.orderId] = tx })
        quick.map((tx) => { quickMapped[tx.orderId] = tx })

        let data = []
        transactions.map((tx) => {
            let transaction = add_usd_values(tx)
            let conduitData = {}
            let precise = preciseMapped[transaction.orderId]
            let quick = quickMapped[transaction.orderId]
            if (precise) {
                transaction.type = 'precise'
                transaction.created = precise.time
                transaction.expiration = (parseFloat(precise.expiration) * 1000)
                transaction.createdToReceived = (parseFloat(transaction.time) * 1000) - (parseFloat(precise.time))
            } else if (quick) {
                transaction.type = 'quick'
                transaction.created = quick.timestamp
                transaction.expiration = null
                transaction.createdToReceived = null
            }
            transaction.receivedDeposit = (parseFloat(transaction.time) * 1000)
            data.push(transaction)
        })

        let fields = ['txid', 'type', 'apiPubKey', 'currencyIn', 'currencyOut', 'amount', 'coinToUser', 'status', 'exchangeUsed', 'exchangeUsed_trade2', 'returnReason', 'returnError', 'created', 'expiration', 'receivedDeposit', 'createdToReceived', 'shiftRate', 'usdValueCoinIn', 'usdValueCoinOut', 'estimatedProfit']

        try {
            // var result = json2csv({ data: data, fields: fields });
            let account = 'shapeshift'
            raw_to_csv(data, account + ':' + timeFrom + ':' + timeTo)

            // fs.unlinkSync('./detailed_txs.csv');
            // fs.appendFile('./detailed_txs.csv', result, function (err) {});

            // //TODO why the fuck do I need to do this!!!!! (upload_error)
            // var execute = function(command){
            //     var d = when.defer();
            //     let tag = TAG+" | execute | "
            //     exec(command, function(error, stdout, stderr) {
            //         if(error) console.error(tag,"stderr: ",stderr)
            //         if(error) console.error(tag,"error: ",error)
            //         if(error) throw Error("101: Failed to execute!")
            //         console.log(stdout)
            //         d.resolve(stdout)
            //     })
            //
            //     return d.promise;
            // }
            //
            // execute("node loger.js detailed_txs.csv")
        } catch (err) {
            // Errors are thrown for bad options, or if the data is empty and no fields are provided.
            // Be sure to provide fields if it is possible that your data array will be empty.
            console.error(err)
        }
    } catch (e) {
        console.error(e)
    }
}

const get_action_summary = async function (actionId) {
    const tag = ' | run_test | '
    const debug = true
    const debug1 = false
    try {
        actionId = actionId.toUpperCase()
        const output = {}
        let actionSummary = await redBack.get(actionId)

        if (!actionSummary) output.success = false, output.error = 'unknown action'
        actionSummary = JSON.parse(actionSummary)
        return actionSummary
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

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
        if (debug) console.log(tag, 'exchangeData: ', exchangeData)

        if (exchangeData.result.withdrawals) {
            // publish both
            await raw_to_csv(exchangeData.result.withdrawals, 'withdrawals:' + account + ':' + coin + ':' + start + ':' + stop)
        }
        if (exchangeData.result.deposits) {
            // publish both
            await raw_to_csv(exchangeData.result.deposits, 'deposits:' + account + ':' + coin + ':' + start + ':' + stop)
        }
        if (Array.isArray(exchangeData.result)) {
            await raw_to_csv(exchangeData.result, account + ':' + coin + ':' + start + ':' + stop)
        }

        if (debug) console.log(tag, 'exchangeData: ', exchangeData)
        if (debug) console.log(tag, 'mongoData: ', mongoData.length)

        // analyize
        // let finalData = compare_datasets(exchangeData,mongoData,account,coin, start, stop)
        return finalData
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const compare_datasets = async function (exchangeData, mongoData, account, coin, start, stop) {
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

        // publish data as csv
        let result1 = await raw_to_csv_exchange(exchangeHistory, coin, start, stop)
        let result2 = await raw_to_csv_mongo(asymHistory, coin, start, stop)

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

let raw_to_csv = async function (data, title) {
    try {
        // let fields = Object.keys(data[0])
        let fields = []

        // iterate over entire dataset
        // get all keys
        for (let i = 0; i < data.length; i++) {
            let entryFields = Object.keys(data[i])
            for (let j = 0; j < entryFields.length; j++) {
                fields.push(entryFields[j])
            }
        }

        fields = fields.filter(function (elem, pos) {
            return fields.indexOf(elem) == pos
        })

        const result = json2csv({ data: data, fields: fields })

        // write to file
        const filename = title + '.csv'
        await write_file(filename, result)

        // upload to slack
        await upload_to_slack(filename, config.slack.financeChannel)

        return { success: true }
    } catch (e) {

    }
}

let raw_to_csv_exchange = async function (exchangeData, coin, start, stop) {
    try {
        //
        const fields = ['id', 'currency', 'method', 'type', 'amount', 'description', 'address', 'status', 'timestamp', 'timestamp_created', 'txid', 'fee']
        const result = json2csv({ data: exchangeData, fields: fields })

        // write to file
        const filename = 'ExchangeRawDump:' + coin + ':' + start + ':' + stop + '.csv'
        await write_file(filename, result)

        // upload to slack
        await upload_to_slack(filename, config.slack.financeChannel)

        return { success: true }
    } catch (e) {

    }
}

let raw_to_csv_mongo = async function (mongoData, coin, start, stop) {
    try {
        //
        const fields = ['date', 'actionId', 'coin', 'amount', 'source', 'destination', 'irregularity', 'totalOwned', 'balanceSourceBefore', 'balanceDestinationBefore', 'balanceSourceAfter', 'balanceDestinationAfter', 'percentTargetSource', 'percentTargetDestination', 'txid', 'user']
        const result = json2csv({ data: exchangeData, fields: fields })

        // write to file
        const filename = 'MongoRawDump:' + coin + ':' + start + ':' + stop + '.csv'
        await write_file(filename, result)

        // upload to slack
        await upload_to_slack(filename, config.slack.financeChannel)

        return { success: true }
    } catch (e) {

    }
}

// const build_report_of_exchange = async function(account,coin,days) {
//     const tag = " | run_test | "
//     const debug = true
//     const debug1 = false
//     try {
//         let time = new Date().getTime()
//         let timeFrom
//         //if no time assume 1 day
//         if(!days){
//             timeFrom = time - 1000 * 60 * 60 * 24
//         } else {
//             timeFrom = time - 1000 * 60 * 60 * 24 * days
//         }
//         let query = {$and:[{coin:coin},{time:{$gt: timeFrom}}]}
//
//         //
//         const data = await reportsH.find(query)
//
//
//         //
//         let exchangeData = await exchanges[account].transferHistory()
//
//         //expand data with pending
//
//         /*
//          const element = {
//          actionId,
//          coin,
//          amount,
//          source,
//          destination,
//          irregularity,
//          totalOwned,
//          balanceSourceBefore,
//          balanceDestinationBefore,
//          balanceSourceAfter,
//          balanceDestinationAfter,
//          percentTargetSource,
//          percentTargetDestination,
//          txid:JSON.stringify(result)
//          }
//          */
//         const fields = ['date','actionId', 'coin', 'amount','source','destination','irregularity','totalOwned','balanceSourceBefore','balanceDestinationBefore','balanceSourceAfter','balanceDestinationAfter','percentTargetSource','percentTargetDestination','txid'];
//
//         const result = json2csv({ data: data, fields: fields });
//         if(debug) console.log(tag,result)
//
//         //write to file
//         const filename = "report:"+ new Date().getTime()+".csv"
//         await write_file(filename,result)
//
//         //upload to slack
//         await upload_to_slack(filename,config.slack.financeChannel)
//
//         return {success:true}
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }

const build_report_csv_by_day = async function (coin, days) {
    const tag = ' | run_test | '
    const debug = true
    const debug1 = false
    try {
        let time = new Date().getTime()
        let timeFrom
        // if no time assume 1 day
        if (!time) {
            timeFrom = time - 1000 * 60 * 60 * 24
        } else {
            timeFrom = time - 1000 * 60 * 60 * 24 * days
        }
        let query = { $and: [{ coin: coin }, { time: { $gt: timeFrom } }] }

        //
        const data = await reportsH.find(query)

        // expand data with pending

        /*
         const element = {
         actionId,
         coin,
         amount,
         source,
         destination,
         irregularity,
         totalOwned,
         balanceSourceBefore,
         balanceDestinationBefore,
         balanceSourceAfter,
         balanceDestinationAfter,
         percentTargetSource,
         percentTargetDestination,
         txid:JSON.stringify(result)
         }
         */
        const fields = ['date', 'actionId', 'coin', 'amount', 'source', 'destination', 'irregularity', 'totalOwned', 'balanceSourceBefore', 'balanceDestinationBefore', 'balanceSourceAfter', 'balanceDestinationAfter', 'percentTargetSource', 'percentTargetDestination', 'txid']

        const result = json2csv({ data: data, fields: fields })
        console.log(result)

        // write to file
        const filename = 'report:' + new Date().getTime() + '.csv'
        await write_file(filename, result)

        // upload to slack
        await upload_to_slack(filename, config.slack.financeChannel)

        return { success: true }
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const build_report_csv = async function (start, end) {
    const tag = ' | build_report_csv | '
    const debug = true
    const debug1 = false
    try {
        console.log(tag, 'checkpoint1')
        const data = await get_actions_from_mongo(start, end)

        /*
         const element = {
         actionId,
         coin,
         amount,
         source,
         destination,
         irregularity,
         totalOwned,
         balanceSourceBefore,
         balanceDestinationBefore,
         balanceSourceAfter,
         balanceDestinationAfter,
         percentTargetSource,
         percentTargetDestination,
         txid:JSON.stringify(result)
         }
         */
        const fields = ['date', 'user', 'actionId', 'coin', 'amount', 'source', 'destination', 'irregularity', 'totalOwned', 'balanceSourceBefore', 'balanceDestinationBefore', 'balanceSourceAfter', 'balanceDestinationAfter', 'percentTargetSource', 'percentTargetDestination', 'txid']

        const result = json2csv({ data: data, fields: fields })
        console.log(result)

        // write to file
        const filename = 'report:' + new Date().getTime() + '.csv'
        await write_file(filename, result)

        // upload to slack
        await upload_to_slack(filename, config.slack.channel)

        return { success: true }
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

/*************************************************************
 //    Tools
 //*************************************************************/

let build_intervial_batch = async function (start, end, size) {
    let tag = TAG + ' | history_rip | '
    let debug = true
    try {
        if (!start) throw Error('101: need start time!')
        if (!end) throw Error('102: need end time!')
        if (debug) console.log(tag, 'start: ', start)
        if (debug) console.log(tag, 'end: ', end)

        // total
        let timeTotal = start - end
        if (debug) console.log(tag, 'timeTotal: ', timeTotal)
        let intervial = timeTotal / size
        if (debug) console.log(tag, 'intervial: ', intervial)

        // set intervial to hours
        let intervials = []
        for (let i = 0; i < size; i++) {
            let timeEnd = start - intervial
            intervials.push([parseInt(start), parseInt(timeEnd)])
            start = timeEnd
        }
        if (debug) console.log(tag, 'intervials: ', intervials)

        return intervials
    } catch (e) {
        console.error(tag, 'error: ', e)
    }
}

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
    let tag = ' | upload_to_slack | '

    slackUp.uploadFile({
        file: fs.createReadStream(filename),
        filetype: 'csv',
        title: filename,
        initialComment: filename,
        channels: channel
    }, function (err, data) {
        if (err) {
            console.error(tag, err)
            d.resolve(false)
        } else {
            console.log('Uploaded file details: ', data)
            d.resolve(true)
        }
    })

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

const get_coins = async function () {
    let tag = TAG + ' | get_coins | '
    try {
        // let staging have more coins
        let env = config.env.setting
        let coins
        if (env == 'prod') {
            coins = await redBack.smembers('autoBalance:coins')
        } else {
            coins = await redBack.smembers('autoBalance:coins:staging')
        }
        return coins
    } catch (e) {
        console.error(tag, 'e: ', e)
    }
}

const get_actions_from_mongo = async function (start, end) {
    const tag = ' | run_test | '
    const debug = true
    const debug1 = false
    try {
        // TODO timeframe!

        //
        const entries = await reportsH.find()
        if (debug) console.log(tag, 'entries: ', entries)

        const output = []
        // filter empty
        for (let i = 0; i < entries.length; i++) {
            if (entries[i].coin) output.push(entries[i])
        }

        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}
