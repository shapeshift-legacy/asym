/**
 * Created by highlander on 7/18/2015.
 */
/**
 * Created by highlander on 7/4/2015.
 */

//* *******************************************************

// Poloniex

//                              - modularized Client
//* *******************************************************

/*

 Summary: Modularity is the degree to which a system's components may be separated and recombined.

 Why is this more moduler?
 * can be required without "running" main loop
 * Individual callbacks can be utilized and unit tests wrote
 * can be required concurently running the same module multiple places
 * can be clusterd without negitive consequences
 * Will not add extra api querys more then rate limited
 * Will maintain vaules concurently via redis

 Prelim
 * have a tick, or runtime
 * maintain status
 * Public (market)
 * private (trade)

 */

let TAG = ' | Poloniex | '

//* ********************************
//        Requires
//* ********************************
require('when/monitor/console')
let poloniex = require('../exchange-support/poloniex.js/lib/poloniex.js')
let co = require('co')

let when = require('when')
// var Big = require('big');
// var log = require('./../log.js')

// var fx = require("money")
let _ = require('underscore')

const config = require('../config')
let client = new poloniex(config.EXCHANGES_CONFIG.Credentials.poloniex.pub, config.EXCHANGES_CONFIG.Credentials.poloniex.pri)

const monk = require('monk')
const db = monk(config.MONGO_URI)

let dbs = {}
let exchange = 'poloniex'
dbs['internalTransactions'] = db.get('internalTransactions')
dbs[exchange + 'Trades'] = db.get(exchange + 'Trades')
dbs[exchange + 'Withdrawals'] = db.get(exchange + 'Withdrawals')
dbs[exchange + 'Deposits'] = db.get(exchange + 'Deposits')
// indexes
dbs['internalTransactions'].ensureIndex({ txid: 1 }, { unique: true })
dbs[exchange + 'Trades'].ensureIndex({ globalTradeID: 1 }, { unique: true })
dbs[exchange + 'Withdrawals'].ensureIndex({ withdrawalNumber: 1 }, { unique: true })
dbs[exchange + 'Deposits'].ensureIndex({ txid: 1 }, { unique: true })

// hookup to syncProfit calculator process through redis / UDP link
// var dgram = require('dgram');
// var udpClient = dgram.createSocket('udp4');
// var Redis = require('promise-redis')();
// var redFront = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT);
// var redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT);
// var uxAPI = require('./uxAPI.js');
//* ********************************
//        Globals
//* ********************************
// uxAPI.setExchange("poloniex", client)
let exchangeName = 'poloniex'

// supported coins
let supportedCoins = config.EXCHANGES_CONFIG.ExchangePairs.alts[exchangeName]
supportedCoins.push('BTC')
let Redis = require('then-redis')
let redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

//* ********************************
//         Module
//* ********************************

/*
           Real time order book strategies

           * sub to socket
           * Query api
           * on load, replay socket events
           * maintain subscription to socket

    maintain async Global Object exportable

    var poloniex =
    {
        market1:{
            bids:[]
            asks:[]
        },
         market2:{
            bids:[]
            asks:[]
         },
    }

    markets are UNIFORM AND MUST MATCH arbiterEngine

    imported
    * getTicker
    * get24hVolume
    * getOrderBook
    * getTradeHistory
    priv
    * myBalances
    * myOpenOrders
    * myTradeHistory
    * buy
    * sell
    * cancelOrder
    * withdraw
    * history

 */

module.exports = {
    name: function () {
        return exchangeName
    },
    addresses: function () {
        return get_all_addresses()
    },
    address: function (coin) {
        return get_new_address(coin)
    },
    balances: function () {
        return get_balances()
    },
    transferHistory: function (coin, start, end) {
        return get_transfer_history(coin, start, end)
    },
    withdrawal: function (coin, amount, destination) {
        return withdrawal_coin(coin, amount, destination)
    },
    withdrawalHistory: function () {
        return get_order_history()
    },
    history: function () {
        return get_order_history()
    },
    tradeHistory: function (pair, start, end) {
        return get_trade_history(pair, start, end)
    },
    tradeHistoryRip: function (start, end, interval) {
        return trade_history_rip(start, end, interval)
    },
    transferHistoryRip: function (start, end, interval) {
        return transfer_history_rip(start, end, interval)
    }
}

//* *******************************
// function primary
//* *******************************

var get_all_addresses = function (pair, start, end) {
    let tag = exchangeName + ' | get_all_addresses | '
    let d = when.defer()

    client.getDepositAddresses(function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            let output = {}
            output.success = true
            output.result = result
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

var get_new_address = function (currency) {
    let tag = exchangeName + ' | get_new_address | '
    let d = when.defer()

    client.getNewDepositAddress(currency, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            let output = {}
            output.success = true
            output.result = result
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

var get_trade_history = function (pair, start, end) {
    let tag = exchangeName + ' | get_withdrawal_history | '
    let d = when.defer()

    start = start / 1000
    end = end / 1000

    client.getTradeHistory(pair, start, end, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            let output = {}
            output.success = true
            output.result = result
            d.resolve(result)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

var get_transfer_history = async function (coin, start, end) {
    let tag = exchangeName + ' | get_withdrawal_history | '
    let debug = true
    try {
        //
        let output = []

        // 1 call per coins
        // let coins = await redBack.smembers("autoBalance:coins")

        // if(debug) console.log(tag,"coins: ", coins)
        // if(debug) console.log(tag,"supportedCoins: ", supportedCoins)

        // for (let i = 0; i < coins.length; i++) {
        //     let coin = coins[i]
        //     coin = coin.toUpperCase()
        //     //if coin is on exchange
        //     if(supportedCoins.indexOf(coin) >=0 ){
        // if(debug) console.log(tag,"supportedCoins: ", supportedCoins)
        let history = await get_order_history(start, end)

        // normalize
        if (debug) console.log(tag, 'history: ', history)

        // normalize
        let deposits = history.result.deposits
        let withdrawals = history.result.withdrawals
        if (debug) console.log(tag, 'deposits: ', deposits)
        if (debug) console.log(tag, 'withdrawals: ', withdrawals)

        let poloWithdrawalCount = await redBack.get('poloWithdrawalCount')
        if (!poloWithdrawalCount) poloWithdrawalCount = 0
        poloWithdrawalCount = parseInt(poloWithdrawalCount)

        if (withdrawals) {
            for (let i = 0; i < withdrawals.length; i++) {
                /*
                         2|asym-sta |   { withdrawalNumber: 510528,
                         2|asym-sta |     currency: 'NXT',
                         2|asym-sta |     address: 'NXT-W3MP-U847-GPSZ-EW7V7',
                         2|asym-sta |     amount: '17501.00000000',
                         2|asym-sta |     fee: null,
                         2|asym-sta |     timestamp: 1425571139,
                         2|asym-sta |     status: 'COMPLETE: 1435174476163887547',
                         2|asym-sta |     ipAddress: 'redacted.example.com' },
                         */

                let entry = withdrawals[i]
                // set highest withdrawalNumber
                let count = parseInt(entry.withdrawalNumber)
                if (poloWithdrawalCount < count) redBack.set('poloWithdrawalCount', count)
                entry.id = entry.currency + ':' + parseInt(entry.timestamp / 1000)
                entry.withdrawal = true
                entry.exchange = exchangeName
                entry.coin = entry.currency
                let status = entry.status
                if (entry.status == 'COMPELTE') {
                    entry.complete = true
                }
                if (status.indexOf('COMPLETE') >= 0) {
                    //
                    let data = status.split(':')
                    entry.txid = data[1].trim()
                    entry.complete = true
                } else {
                    entry.complete = false
                }
                output.push(entry)
            }
        }

        if (deposits) {
            for (let i = 0; i < deposits.length; i++) {
                let entry = deposits[i]
                entry.exchange = exchangeName
                entry.deposit = true
                entry.id = entry.txid
                entry.coin = entry.currency
                if (entry.status === 'COMPLETE') {
                    entry.complete = true
                } else {
                    entry.complete = false
                }
                output.push(entry)
            }
        }

        //    }
        //
        // }

        return output
    } catch (e) {
        console.error(tag, 'error: ', e)
        throw (e)
    }
}

let get_withdrawal_history = function (coin) {
    let tag = exchangeName + ' | get_withdrawal_history | '
    let d = when.defer()

    coin = coin.toLowerCase()

    client.movements(coin, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            let output = {}
            output.success = true
            output.result = result
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

var withdrawal_coin = function (coin, amount, address) {
    let tag = exchangeName + ' | submit_withdrawal | '
    let d = when.defer()
    let currency = coin.toUpperCase()
	if(currency === "BCH") currency = "BCHABC"
    console.log(tag, 'currency: ', currency)
    console.log(tag, 'amount: ', amount)
    console.log(tag, 'address: ', address)

    let output = {}
    output.success = false

    client.withdraw(currency, amount, address, function (err, resp) {
        if (err) {
            console.error(tag, err, resp)
            output.error = err
            d.resolve(output)
        } else {
            console.log(tag, 'Response: ', resp)
            if (resp.error) {
                output.error = resp.error
                d.resolve(output)
            } else {
                output.success = true
                output.message = resp
                d.resolve(output)
            }
        }
    })

    return d.promise
}

var get_order_history = function (start, end) {
    let tag = exchangeName + ' | get_order_history | '
    let d = when.defer()

    start = start / 1000
    end = end / 1000

    // hours = parseInt(hours)
    // if(!hours) hours = 1
    // var time = new Date().getTime() / 1000
    // var start = time - 60 * 60 * hours

    client.history(start, end, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            let output = {}
            output.success = true
            output.result = result
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })
    return d.promise
}

// var post_bid = function(pair, rate,amount){
//     var tag = exchangeName+" | post_bid | "
//     var d = when.defer();
//
//     //var poloniexPair = ["BTC","LTC"]
//     var poloniexPair = pair.split("_")
//     console.log(tag,"rate : ",rate)
//     console.log(tag,"amount : ",amount)
//     client.buy(poloniexPair[0],poloniexPair[1], rate, amount, function(error, result){
//         if(error){
//             console.error(tag," Error: ", error)
//         } else {
//             console.log(tag, " resp: ", result)
//             d.resolve(result)
//         }
//     });
//     return d.promise
// }
//
// var post_ask = function(pair,  rate,amount){
//     var tag = exchangeName+" | post_buy | "
//     var d = when.defer();
//
//     client.sell(poloniexPair[0],poloniexPair[1], rate, amount, function(error, result) {
//         if (error) {
//             console.error(tag, " Error: ", error)
//         } else {
//             console.log(tag, " resp: ", result)
//         }
//     });
//     return d.promise
// }
//

const get_balances = function () {
    let tag = exchangeName + ' | get_balances | '
    let d = when.defer()
    let debug = true
    client.myBalances(function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            // if(debug)console.log(tag,"result: ",result)
            // var output = {}
            // output.success = true
            // output.result = result.result
            d.resolve(result)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })
    return d.promise
}

//
// var get_orderbook = function(pair){
//     var tag = exchangeName+" | get_orderbook | "
//     var d = when.defer();
//     var coins = pair.split("_")
//
//     //console.log(tag,'pair: ', pair)
//     //console.log(tag,'coins: ', coins)
//     var second = coins[0]
//     var prime = coins[1]
//     client.getOrderBook(second, prime,function(err, result){
//         //console.log(err,result)
//         if(err)
//         {
//             return d.reject("depth|"+err+' pair:'+pair)
//         }
//         else if(!result)
//         {
//             return d.reject("depth| No result returned for pair :" + pair)
//         }
//
//         //console.log(tag, result)
//         d.resolve(result)
//     })
//     return d.promise
// }
//
// var initialize_poloniex = co.wrap(function* () {
//     var tag = " | initialize_poloniex | "
//     var time = Date().getTime()
//
//     // sub to poloniex
//
//     // que events
//
//     // que api
//
//     // replay events
//
//
// })

/*******************************************
 // Rippers
 //******************************************/

let build_interval_batch = async function (start, end, size) {
    let tag = TAG + ' | history_rip | '
    let debug = false
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
        if (debug) console.log(tag, 'intervals: ', intervials)

        return intervials
    } catch (e) {
        console.error(tag, 'error: ', e)
    }
}

let digest_trade_history = async function (dataChunk, exchange, pair, coin) {
    let tag = TAG + ' | digest_trade_history | '
    let debug = false
    try {
        if (debug) console.log(tag, 'dataChunk: ', dataChunk)
        // if(debug) console.log(tag,"coin: ",coin)
        if (debug) console.log(tag, 'exchange: ', exchange)

        for (let i = 0; i < dataChunk.length; i++) {
            let entry = dataChunk[i]
            if (debug) console.log(tag, 'id: ', entry.globalTradeID)
            // save raw entry to db
            entry.timestamp = new Date(entry.date).getTime() / 1000
            entry.pair = pair
            entry.coin = coin
            try {
                let success = await dbs[exchange + 'Trades'].insert(entry)
            } catch (e) {
                if (debug) console.error(tag, 'error: ', e)
            }
            if (debug) console.log(tag, 'success: ', success)
        }
    } catch (e) {
        // off to ignore duplicate keys
        if (debug) console.error(tag, 'error: ', e)
    }
}

let digest_transfer_history = async function (dataChunk, exchange) {
    let tag = TAG + ' | digest_transfer_history | '
    let debug = true
    try {
        if (debug) console.log(tag, 'dataChunk: ', dataChunk)
        // if(debug) console.log(tag,"coin: ",coin)
        if (debug) console.log(tag, 'exchange: ', exchange)

        for (let i = 0; i < dataChunk.length; i++) {
            let entry = dataChunk[i]
            if (debug) console.log(tag, 'id: ', entry.id)
            // save raw entry to db
            entry.timestamp = parseFloat(entry.timestamp)
            if (debug) console.log(tag, 'entry: ', entry)
            try {
                // if contains txid
                if (entry.txid) {
                    // save in internalTransactions
                    let options = { upsert: true }
                    let success = await dbs['internalTransactions'].update({ txid: entry.txid }, { $set: entry }, options)
                }

                // if withdrawal
                if (entry.withdrawal) {
                    let success = await dbs[exchange + 'Withdrawals'].insert(entry)
                }

                // if deposit
                if (entry.deposit) {
                    let success = await dbs[exchange + 'Deposits'].insert(entry)
                }
            } catch (e) {
                if (debug) console.error(tag, 'error: ', e, ' entry: ', entry)
            }
        }
    } catch (e) {
        // off to ignore duplicate keys
        console.error(tag, 'error: ', e)
    }
}

let transfer_history_rip = async function (start, end, interval) {
    let tag = TAG + ' | transfer_history_rip | '
    let debug = true
    try {
        let output = {}
        output.exchange = exchangeName
        output.transfers = []

        let batch = await build_interval_batch(start, end, interval)
        if (debug) console.log(tag, 'batch: ', batch)
        // try first interval
        // if limit, rebatch with higher interval

        start = start / 1000
        end = end / 1000

        let latest = 0
        let earliest = 0

        // for each exchange
        // let exchangeNames = Object.keys(exchanges)

        for (let k = 0; k < batch.length; k++) {
            let interval = batch[k]
            let dataChunk = await get_transfer_history('', interval[0], interval[1])
            if (debug) console.log(tag, 'dataChunk: ', dataChunk.length)

            for (let k = 0; k < dataChunk.length; k++) {
                // if inside time range, add
                let time = dataChunk[k].timestamp
                if (debug) console.log(tag, 'time: ', time)
                if (debug) console.log(tag, 'time: ', new Date(time * 1000).toString())
                if (time > latest) latest = time
                if (time < earliest || earliest === 0) earliest = time
                if (time < end && time > start) {
                    output.transfers.push(dataChunk[k])
                } else {

                }
            }

            // digest data
            let success = await digest_transfer_history(dataChunk, exchange)
            // pause
            await pause(1)
        }
        if (debug) console.log('latest: ', latest)
        if (debug) console.log(tag, 'latest: ', new Date(latest * 1000).toString())
        if (debug) console.log('earliest: ', earliest)
        if (debug) console.log(tag, 'earliest: ', new Date(earliest * 1000).toString())

        output.availiblity = {
            latest, earliest
        }
        console.log('******** DONE ***************')
        return output
    } catch (e) {
        console.error(tag, 'error: ', e)
    }
}

let trade_history_rip = async function (start, end, intervial) {
    let tag = TAG + ' | trade_history_rip | '
    let debug = true
    try {
        let output = {}
        output.exchange = exchangeName
        output.trades = []

        let batch = await build_interval_batch(start, end, intervial)
        if (debug) console.log(tag, 'batch: ', batch)
        // try first intervial
        // if limit, rebatch with higher interval

        start = start / 1000
        end = end / 1000

        let latest = 0
        let earliest = 0

        // for each exchange
        // let exchangeNames = Object.keys(exchanges)
        let exchangeNames = ['poloniex']
        // let coins = ["ZEC","REP","STEEM","LBC","LSK","NXT", "LTC", "XRP", "BTS", "BITUSD", "DOGE", "DGB", "LSK", "VRC", "DRK", "POT", "MINT", "CLAM", "XMR", "XCP", "MSC", "SJCX", "GEMZ", "STR", "MAID", "ETH", "DASH", "BCY", "VTC", "FCT","ETC", "GNT","GNO", "GAME", "DCR", "SC", "NMC", "PPC","REP","GNO","ZRX"]
        let coins = get_coins_config('poloniex')
        coins.reverse()

        for (let j = 0; j < coins.length; j++) {
            let coin = coins[j]
            coin = coin.toUpperCase()
            console.log('coin: ', coin)
            if (coin != 'BTC') {
                // for each coin
                for (let k = 0; k < batch.length; k++) {
                    let intervial = batch[k]
                    let pair = 'BTC_' + coin
                    let dataChunk = await get_trade_history(pair, intervial[0], intervial[1])
                    if (debug) console.log(tag, 'dataChunk: ', dataChunk.length)

                    for (let k = 0; k < dataChunk.length; k++) {
                        // if inside time range, add
                        let time = new Date(dataChunk[k].date).getTime() / 1000
                        dataChunk[k].timestamp = time
                        if (debug) console.log(tag, 'time: ', time)
                        if (debug) console.log(tag, 'time: ', new Date(time * 1000).toString())
                        if (time > latest) latest = time
                        if (time < earliest || earliest === 0) earliest = time
                        if (time < end && time > start) {
                            output.trades.push(dataChunk[k])
                        } else {

                        }
                    }

                    // digest data
                    let success = await digest_trade_history(dataChunk, exchange, pair, coin)
                    // pause
                    await pause(1)
                }
            }
        }

        if (debug) console.log('latest: ', latest)
        if (debug) console.log(tag, 'latest: ', new Date(latest * 1000).toString())
        if (debug) console.log('earliest: ', earliest)
        if (debug) console.log(tag, 'earliest: ', new Date(earliest * 1000).toString())

        output.availiblity = {
            latest, earliest
        }
        console.log('******** DONE ***************')
        return output
    } catch (e) {
        console.error(tag, 'error: ', e)
    }
}

const get_coins_config = function (exchange) {
    let tag = TAG + ' | get_coins | '
    try {
        let coins = config.EXCHANGES_CONFIG.ExchangePairs.alts[exchange]
        coins.push('BTC')
        return coins
    } catch (e) {
        console.error(tag, 'e: ', e)
    }
}

// functions
var pause = function (length) {
    let d = when.defer()
    let done = function () { d.resolve(true) }
    setTimeout(done, length * 1000)
    return d.promise
}
