/**
 * Created by highlander on 4/12/17.
 */
/**
 * Created by highlander on 4/7/17.
 */
/**
 * Created by highlander on 7/18/2015.
 */
/**
 * Created by highlander on 7/4/2015.
 */

//* *******************************************************
let TAG = ' | bittrex | '
// bittrex

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

//* ********************************
//        Requires
//* ********************************
require('when/monitor/console')
const bittrex = require('bittrex-api')
const co = require('co')

const when = require('when')
// const Big = require('big');
// const log = require('./../log.js')

// const fx = require("money")
const _ = require('underscore')

const config = require('../config')
// console.log("pub: ",secret.bittrex.pub)
// console.log("pri: ",secret.bittrex.pri)
const client = new bittrex(config.EXCHANGES_CONFIG.Credentials.bittrex.pub, config.EXCHANGES_CONFIG.Credentials.bittrex.pri)

//
const monk = require('monk')
const db = monk(config.MONGO_URI)

let dbs = {}
let exchange = 'bittrex'
// dbs[exchange+"Trades"] = db.get(exchange+"Trades");
// dbs[exchange+"Transfers"] = db.get(exchange+"Transfers");
// dbs[exchange+"Trades"].ensureIndex({id: 1}, {unique: true})
// dbs[exchange+"Transfers"].ensureIndex({id: 1}, {unique: true})

dbs['internalTransactions'] = db.get('internalTransactions')
dbs[exchange + 'Trades'] = db.get(exchange + 'Trades')
dbs[exchange + 'Withdrawals'] = db.get(exchange + 'Withdrawals')
dbs[exchange + 'Deposits'] = db.get(exchange + 'Deposits')
// indexes
dbs['internalTransactions'].ensureIndex({ txid: 1 }, { unique: true })
dbs[exchange + 'Trades'].ensureIndex({ OrderUuid: 1 }, { unique: true })
dbs[exchange + 'Withdrawals'].ensureIndex({ id: 1 }, { unique: true })
dbs[exchange + 'Deposits'].ensureIndex({ txid: 1 }, { unique: true })

//* ********************************
//        Globals
//* ********************************
// uxAPI.setExchange("bittrex", client)
const exchangeName = 'bittrex'
// constants

let supportedCoins = config.EXCHANGES_CONFIG.ExchangePairs.alts[exchangeName]
supportedCoins.push('BTC')
//* ********************************
//         Module
//* ********************************

module.exports = {
    // async
    name: function () {
        return exchangeName
    },
    // //promise
    // initialize: function() {
    //     return initialize_bittrex();
    // },
    coins: function () {
        return get_coins()
    },

    getTicker: function (market) {
        return get_ticker(market)
    },

    getSummary: function () {
        return get_Summary()
    },
    address: function (coin) {
        return get_new_address(coin)
    },
    addresses: function () {
        return get_addresses()
    },

    //
    // run: function() {
    //     return run_bittrex();
    // },
    //
    // status: function() {
    //     return get_bittrex_status();
    // },
    //
    // getpairs: function() {
    //     return get_all_pairs();
    // },
    //
    balances: function () {
        return get_balances()
    },

    ordersOpen: function () {
        return get_open_orders()
    },

    getOrder: function (uuid) {
        return lookup_order(uuid)
    },

    //
    withdrawal: function (coin, amount, destination) {
        return withdrawal_coin(coin, amount, destination)
    },
    //
    // getorderbook: function(pair) {
    //     return get_orderbook(pair);
    // },

    transferHistory: function (coin) {
        return get_transfer_history(coin)
    },

    tradeHistory: function (market) {
        return get_trade_history(market)
    },

    withdrawalHistory: function (coin) {
        return get_withdrawal_history(coin)
    },

    depositHistory: function (coin) {
        return get_deposit_history(coin)
    },

    bid: function (pair, rate, amount) {
        return post_bid(pair, rate, amount)
    },

    ask: function (pair, rate, amount) {
        return post_ask(pair, rate, amount)
    },

    bidMarket: function (pair, amount) {
        return post_bid_market(pair, amount)
    },

    askMarket: function (pair, amount) {
        return post_ask_market(pair, amount)
    },

    tradeHistoryRip: function (start, end, interval) {
        return trade_history_rip(start, end, interval)
    },

    transferHistoryRip: function (start, end, interval) {
        return transfer_history_rip(start, end, interval)
    },
}

/********************************
//function primary
//********************************/

const get_coins = function () {
    const tag = exchangeName + ' | get_coins | '
    const d = when.defer()
    const debug = false
    if (debug) console.log(tag, 'checkpoint1')

    // const bittrexPair = pair.split("_")
    // const bittrexMarket = bittrexPair[0]+"-"+bittrexPair[1]

    client.getcurrencies(function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let data = result.result
            let output = {}
            for (let i = 0; i < data.length; i++) {
                let entry = data[i]
                output[entry.Currency] = entry
            }

            // let output = {}
            // output.address = data.Address
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_open_orders = function () {
    const tag = exchangeName + ' | get_open_orders | '
    const d = when.defer()
    const debug = true
    if (debug) console.log(tag, 'checkpoint1')

    // const bittrexPair = pair.split("_")
    // const bittrexMarket = bittrexPair[0]+"-"+bittrexPair[1]

    client.getopenorders(null, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let data = result.result
            // let output = {}
            // output.address = data.Address
            d.resolve(data)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_new_address = function (coin) {
    const tag = exchangeName + ' | get_new_address | '
    const d = when.defer()
    coin = coin.toUpperCase()
    const debug = true
    if (debug) console.log(tag, 'checkpoint1')
    client.getdepositaddress(coin, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let data = result.result
            // let output = {}
            // output.address = data.Address
            d.resolve(data.Address)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_addresses = function () {
    const tag = exchangeName + ' | get_addresses | '
    const d = when.defer()
    const debug = false
    if (debug) console.log(tag, 'checkpoint1')
    client.getbalances(function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let data = result.result
            let output = {}

            for (let i = 0; i < data.length; i++) {
                let entry = data[i]
                output[entry.Currency] = entry.CryptoAddress
            }

            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_Summary = function () {
    const tag = exchangeName + ' | get_Summary | '
    const d = when.defer()
    const debug = false

    client.getmarketsummaries(function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let withdrawals = result.result
            // const output = {}
            // output.success = true
            // output.result = withdrawals
            d.resolve(withdrawals)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_ticker = function (market) {
    const tag = exchangeName + ' | get_ticker | '
    const d = when.defer()
    const debug = false

    client.getticker(market, function (err, result) {
        if (err) {
            console.error(tag, err, result)
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let withdrawals = result.result
            // const output = {}
            // output.success = true
            // output.result = withdrawals
            d.resolve(withdrawals)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const lookup_order = function (uuid) {
    const tag = exchangeName + ' | lookup_order | '
    const d = when.defer()
    const debug = true

    client.getorder(uuid, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let withdrawals = result.result
            const output = {}
            output.success = true
            output.result = withdrawals
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_transfer_history = async function (coin) {
    const tag = exchangeName + ' | get_transfer_history | '
    let debug = false
    try {
        if (debug) console.log(tag, 'coin: ', coin)
        //
        let output = []

        let deposits = await get_deposit_history(coin)
        let withdrawals = await get_withdrawal_history(coin)

        if (debug) console.log(tag, 'deposits: ', deposits)
        if (debug) console.log(tag, 'withdrawals: ', withdrawals)

        // normalize
        deposits = deposits.result
        withdrawals = withdrawals.result

        if (deposits) {
            for (let i = 0; i < deposits.length; i++) {
                // normalize
                let entry = deposits[i]
                entry.deposit = true
                entry.coin = entry.Currency
                entry.txid = entry.TxId
                entry.id = entry.TxId
                entry.address = entry.CryptoAddress
                entry.amount = entry.Amount
                entry.timestamp = new Date(entry.LastUpdated).getTime() / 1000
                if (entry.Confirmations > 0) entry.complete = true
                if (!entry.complete) entry.status = 'incomplete'
                entry.exchange = exchangeName
                output.push(entry)
            }
        }

        if (withdrawals) {
            for (let i = 0; i < withdrawals.length; i++) {
                let entry = withdrawals[i]
                entry.withdrawal = true
                entry.timestamp = new Date(entry.Opened).getTime() / 1000
                entry.id = entry.PaymentUuid
                entry.coin = entry.Currency
                entry.txid = entry.TxId
                entry.address = entry.CryptoAddress
                entry.amount = entry.Amount
                if (entry.txid) entry.complete = true
                if (!entry.complete) entry.status = 'incomplete'
                entry.exchange = exchangeName
                output.push(entry)
            }
        }

        return output
    } catch (e) {
        console.error(tag, 'error: ', e)
        throw (e)
    }
}

const get_deposit_history = function (coin) {
    const tag = exchangeName + ' | get_deposit_history | '
    const d = when.defer()
    const debug = false

    if (coin)coin = coin.toLowerCase()
    if (debug) console.log(tag, 'coin: ', coin)
    client.getdeposithistory(coin, 10000, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, 'result :', result)
            let withdrawals = result.result
            const output = {}
            output.success = true
            output.result = withdrawals
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_withdrawal_history = function (coin) {
    const tag = exchangeName + ' | get_withdrawal_history | '
    const d = when.defer()
    const debug = false

    if (coin)coin = coin.toLowerCase()

    client.getwithdrawalhistory(coin, 10000, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, 'result :', result)
            let withdrawals = result.result
            const output = {}
            output.success = true
            output.result = withdrawals
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

//
const withdrawal_coin = function (coin, amount, address) {
    const tag = exchangeName + ' | submit_withdrawal | '
    const d = when.defer()
    const debug = true
    coin = coin.toUpperCase()
    if (coin === 'NEO') amount = amount + 0.025

    if (debug) console.log(tag, 'coin:', coin)
    if (debug) console.log(tag, 'amount:', amount)
    if (debug) console.log(tag, 'address:', address)

    let output = {}
    output.success = false

    client.withdraw(coin, amount, address, '', function (err, resp) {
        if (err) {
            console.error(tag, err, resp)
            output.error = err
            d.resolve(output)
        } else {
            console.error(tag, 'Response: ', resp)
            if (resp.success) {
                output.success = true
                if (resp && resp.result && resp.result.uuid) output.id = resp.result.uuid
                else throw Error('unhandled response format!', resp)
                d.resolve(output)
            } else {
                output.error = resp.message
                d.resolve(output)
            }
        }
    })

    return d.promise
}

//
const get_trade_history = function (market) {
    const tag = exchangeName + ' | get_trade_history | '
    const d = when.defer()
    let debug = true
    client.getorderhistory(market, 51, function (err, result) {
        if (err) {
            console.error(tag, 'e: ', err)
            return d.reject(err)
        }
        if (result) {
            if (debug) console.log(tag, 'result: ', result)
            let output = []
            let data = result.result
            // normalize trade data
            for (let j = 0; j < data.length; j++) {
                let entry = data[j]

                let timestamp = new Date(entry.TimeStamp).getTime()
                entry.timestamp = timestamp / 1000
                //
                output.push(entry)
            }

            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })
    return d.promise
}

const post_bid_market = function (pair, amount) {
    const tag = exchangeName + ' | post_bid_market | '
    const d = when.defer()

    // const bittrexPair = ["BTC","LTC"]
    const bittrexPair = pair.split('_')
    const bittrexMarket = bittrexPair[0] + '-' + bittrexPair[1]
    console.log(tag, 'rate : ', rate)
    console.log(tag, 'bittrexMarket : ', bittrexMarket)
    client.buymarket(bittrexMarket, amount, function (error, result) {
        if (error) {
            console.error(tag, ' Error: ', error)
        } else {
            console.log(tag, ' resp: ', result)
            d.resolve(result)
        }
    })
    return d.promise
}

const post_ask_market = function (pair, amount) {
    const tag = exchangeName + ' | post_ask_market | '
    const d = when.defer()
    const bittrexPair = pair.split('_')
    const bittrexMarket = bittrexPair[0] + '-' + bittrexPair[1]

    console.log(tag, 'amount : ', amount)
    console.log(tag, 'bittrexMarket : ', bittrexMarket)

    client.sellmarket(bittrexMarket, amount, function (error, result) {
        if (error) {
            console.error(tag, ' Error: ', error)
        } else {
            console.log(tag, ' resp: ', result)
            d.resolve(result)
        }
    })
    return d.promise
}

const post_bid = function (pair, rate, amount) {
    const tag = exchangeName + ' | post_bid | '
    const d = when.defer()

    // const bittrexPair = ["BTC","LTC"]
    const bittrexPair = pair.split('_')
    const bittrexMarket = bittrexPair[0] + '-' + bittrexPair[1]
    console.log(tag, 'rate : ', rate)
    console.log(tag, 'amount : ', amount)
    console.log(tag, 'bittrexMarket : ', bittrexMarket)
    client.buylimit(bittrexMarket, amount, rate, function (error, result) {
        if (error) {
            console.error(tag, ' Error: ', error)
        } else {
            console.log(tag, ' resp: ', result)
            d.resolve(result)
        }
    })
    return d.promise
}

const post_ask = function (pair, rate, amount) {
    const tag = exchangeName + ' | post_ask | '
    const d = when.defer()
    const bittrexPair = pair.split('_')
    const bittrexMarket = bittrexPair[0] + '-' + bittrexPair[1]
    console.log(tag, 'rate : ', rate)
    console.log(tag, 'amount : ', amount)
    console.log(tag, 'bittrexMarket : ', bittrexMarket)

    client.selllimit(bittrexMarket, amount, rate, function (error, result) {
        if (error) {
            console.error(tag, ' Error: ', error)
        } else {
            console.log(tag, ' resp: ', result)
            d.resolve(result)
        }
    })
    return d.promise
}
//

const get_balances = function () {
    const tag = exchangeName + ' | get_balances | '
    const d = when.defer()
    let debug = false
    client.getbalances(function (err, resp) {
        // console.error(tag,err,resp)
        if (err) {
            console.error(tag, err, resp)
        } else {
            // console.log(tag,"Response: ",resp)

            let entries = resp.result
            const output = {}
            for (let j = 0; j < entries.length; j++) {
                let entry = entries[j]
                output[entry.Currency] = entry.Available
            }

            d.resolve(output)
        }
    })
    return d.promise
}

//
// const get_orderbook = function(pair){
//     const tag = exchangeName+" | get_orderbook | "
//     const d = when.defer();
//     const coins = pair.split("_")
//
//     //console.log(tag,'pair: ', pair)
//     //console.log(tag,'coins: ', coins)
//     const second = coins[0]
//     const prime = coins[1]
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
// const initialize_bittrex = co.wrap(function* () {
//     const tag = " | initialize_bittrex | "
//     const time = Date().getTime()
//
//     // sub to bittrex
//
//     // que events
//
//     // que api
//
//     // replay events
//
//
// })
//

/**********************************************************
// Data Ripper!
//**********************************************************/

let build_intervial_batch = async function (start, end, size) {
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

        // set interval to hours
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

let digest_transfer_history = async function (dataChunk, exchange) {
    let tag = TAG + ' | digest_transfer_history | '
    let debug = false
    try {
        if (debug) console.log(tag, 'dataChunk: ', dataChunk.length)
        // if(debug) console.log(tag,"coin: ",coin)
        if (debug) console.log(tag, 'exchange: ', exchange)

        for (let i = 0; i < dataChunk.length; i++) {
            let entry = dataChunk[i]
            if (debug) console.log(tag, 'id: ', entry.id)
            // save raw entry to db
            entry.timestamp = parseFloat(entry.timestamp)
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
                if (debug) console.error(tag, 'error: ', e)
            }
            if (debug) console.log(tag, 'success: ', success)
        }
    } catch (e) {
        // off to ignore duplicate keys
        if (debug) console.error(tag, 'error: ', e)
    }
}

let digest_trade_history = async function (dataChunk, exchange) {
    let tag = TAG + ' | digest_trade_history | '
    let debug = false
    try {
        if (debug) console.log(tag, 'dataChunk: ', dataChunk.length)
        // if(debug) console.log(tag,"coin: ",coin)
        if (debug) console.log(tag, 'exchange: ', exchange)

        for (let i = 0; i < dataChunk.length; i++) {
            let entry = dataChunk[i]
            if (debug) console.log(tag, 'id: ', entry)
            // save raw entry to db
            let timestamp = new Date(entry.TimeStamp).getTime()
            entry.timestamp = timestamp / 1000
            try {
                let success = await dbs[exchange + 'Trades'].insert(entry)
            } catch (e) {
                if (debug) console.error(tag, 'error: ', e)
            }
        }
    } catch (e) {
        // off to ignore duplicate keys
        if (debug) console.error(tag, 'error: ', e)
    }
}

let transfer_history_rip = async function (start, end, intervial) {
    let tag = TAG + ' | transfer_history_rip | '
    let debug = true
    try {
        let output = {}
        output.exchange = 'bittrex'
        output.transfers = []

        start = start / 1000
        end = end / 1000

        let exchangeNames = ['bittrex']
        // let coins = ["EDG","BTCD", "BLK", "BTS", "DAO", "DGB", "DOGE", "EMC", "LTC", "MONA", "FTC", "NAV", "NEOS", "NXT", "POT", "RDD", "SDC", "START", "UNO", "VIA", "VRC", "XAI", "TRON", "MONA", "VTC", "IOC", "NEOS", "TRON", "ARCH", "HYPER", "FLO"]
        let coins = await get_coins_config()

        if (debug) console.log('start: ', start)
        if (debug) console.log('end: ', end)
        if (debug) console.log('start: ', end)

        for (let i = 0; i < exchangeNames.length; i++) {
            let exchange = exchangeNames[i]
            // for each batch chunk
            for (let j = 0; j < coins.length; j++) {
                let coin = coins[j]
                // for each coin
                let dataChunk = await get_transfer_history(coin)
                if (debug) console.log(tag, 'dataChunk: ', dataChunk.length)

                // iterate over it
                let latest = 0
                let earliest = 0

                for (let k = 0; k < dataChunk.length; k++) {
                    // if inside time range, add
                    let time = dataChunk[k].timestamp
                    // if(debug) console.log(tag,"time: ",time)
                    // if(debug) console.log(tag,"time: ",new Date(time * 1000).toString())
                    if (time > latest) latest = time
                    if (time < earliest || earliest === 0) earliest = time
                    if (time < end && time > start) {
                        output.transfers.push(dataChunk[k])
                    }
                }

                if (debug) console.log('latest: ', latest)
                if (debug) console.log(tag, 'latest: ', new Date(latest * 1000).toString())
                if (debug) console.log('earliest: ', earliest)
                if (debug) console.log(tag, 'earliest: ', new Date(earliest * 1000).toString())

                output.availiblity = {
                    latest, earliest
                }

                // digest data
                let success = await digest_transfer_history(dataChunk, exchange)
                // pause
                await pause(1)
            }
        }

        console.log('******** DONE ***************')
        return output
    } catch (e) {
        console.error(tag, 'error: ', e)
    }
}

let trade_history_rip = async function (start, end, interval) {
    let tag = TAG + ' | transfer_history_rip | '
    let debug = true
    try {
        /*

        NOTE: Bittrex does NOT allow full ripping!
            We can only limit the entries
            and can NOT specify the time!!!!!

            yea, bittrex sucks

            anyway, interval is ignored, and timestamping is filtered manually
        */
        let output = {}
        output.exchange = 'bittrex'
        output.transfers = []

        start = start / 1000
        end = end / 1000

        // iterate over it
        let latest = 0
        let earliest = 0

        let exchangeNames = ['bittrex']
        // let coins = [ "NEO"]
        let coins = await get_coins_config('bittrex')
        console.log(tag, 'checkpoint1 ')
        for (let j = 0; j < coins.length; j++) {
            let coin = coins[j]
            if (coin !== 'BTC') {
                // for each coin
                let market = 'BTC-' + coin
                console.log(tag, 'market:  ', market)
                let dataChunk = await get_trade_history(market)
                // if(debug) console.log(tag,"dataChunk: ",dataChunk)
                if (debug && dataChunk) console.log(tag, 'dataChunk: ', dataChunk.length)

                for (let k = 0; k < dataChunk.length; k++) {
                    // if inside time range, add
                    let time = dataChunk[k].timestamp
                    // if(debug) console.log(tag,"time: ",time)
                    // if(debug) console.log(tag,"time: ",new Date(time * 1000).toString())
                    if (time > latest) latest = time
                    if (time < earliest || earliest === 0) earliest = time
                    if (time < end && time > start) {
                        output.transfers.push(dataChunk[k])
                    }
                }

                // digest data
                let success = await digest_trade_history(dataChunk, exchange)
                // pause
                await pause(1)
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
    let tag = TAG + ' | get_coins_config | '
    try {
        console.log('exchange: ', exchange)
        let coins = []
        coins = config.EXCHANGES_CONFIG.ExchangePairs.alts['bittrex']
        // coins.push("BTC")
        return coins
    } catch (e) {
        console.error(tag, 'e: ', e)
    }
}

const pause = function (length) {
    const d = when.defer()
    const done = function () { d.resolve(true) }
    setTimeout(done, length * 1000)
    return d.promise
}
