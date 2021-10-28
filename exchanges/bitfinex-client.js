/**
 * Created by highlander on 7/18/2015.
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

//* ********************************
//        Requires
//* ********************************
// require('when/monitor/console');
const Bitfinex = require('../exchange-support/bitfinex')

// const settings = require('./../modules/settings.js')

const when = require('when')
const TAG = ' | Bitfinex | '
const config = require('../config')

const monk = require('monk')
const db = monk(config.MONGO_URI)
let dbs = {}
let exchange = 'bitfinex'
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
dbs[exchange + 'Trades'].ensureIndex({ globalTradeID: 1 }, { unique: true })
dbs[exchange + 'Withdrawals'].ensureIndex({ id: 1 }, { unique: true })
dbs[exchange + 'Deposits'].ensureIndex({ txid: 1 }, { unique: true })

client = new Bitfinex(config.EXCHANGES_CONFIG.Credentials.bitfinex.pub, config.EXCHANGES_CONFIG.Credentials.bitfinex.pri, {
    nonce: function () {
        // currentNonce = Math.round((new Date()).getTime() / 1000) + 2;
        currentNonce++
        fs.writeFile('./nonce.json', currentNonce)
        return currentNonce
    }
})

// hookup to syncProfit calculator process through redis / UDP link
const dgram = require('dgram')

//* ********************************
//        Globals
//* ********************************
// uxAPI.setExchange("client", client)
const exchangeName = 'bitfinex'
let supportedCoins = config.EXCHANGES_CONFIG.ExchangePairs.alts[exchangeName]
supportedCoins.push('BTC')

const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

/*
    Public
    * ticker
    * today
    * candles
    * lendbook
    * orderbook
    * trades
    * lends
    * get_symbols
    * symbols_details
    *
    Private
    * new_order
    * multiple_new_orders
    * replace_order
    * order_status
    * active_orders
    * active_positions
    * movementsByTime
    * movements
    * tradesByTime
    * past_trades
    * new_deposit
    * new_offer
    * cancel_offer
    * offer_status
    * active_offers
    * active_credits
    * wallet_balances
    * taken_swaps
    * close_swap
    * account_infos
    * margin_infos
    * withdraw
    * transfer

 */

//* ********************************
//         Module
//* ********************************

module.exports = {
    name: function () {
        return exchangeName
    },
    withdrawal: function (coin, amount, address) {
        return submit_withdrawal(coin, amount, address)
    },
    balances: function () {
        return get_balances()
    },
    transferHistory: function (coin, start, end) {
        return get_transfer_history(coin, start, end)
    },
    withdrawalHistory: function (coin) {
        return get_withdrawal_history(coin)
    },
    history: function (coin, start, end) {
        return get_history(coin, start, end)
    },
    tradeHistory: function (coin, start, end) {
        return get_trade_history(coin, start, end)
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

const get_balances = function () {
    const tag = exchangeName + ' | get_balances | '
    const d = when.defer()
    const debug = true

    if (debug) console.log(tag, 'debug: ', debug)

    client.wallet_balances(function (err, result) {
        if (err) {
            console.error(tag, 'err: ', err)
            return d.reject(err)
        }
        if (result) {
            if (debug)console.log('result: ', result)

            const output = {}
            for (let j = 0; j < result.length; j++) {
                let entry = result[j]
                if (entry.type == 'deposit') output[entry.currency] = entry.amount
            }

            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_transfer_history = async function (coin, start, end) {
    const tag = ' | ' + exchangeName + ' | get_transfer_history | '
    let debug = false
    try {
        if (!start) throw Error('101: no start time!!')
        if (!end) throw Error('101: no end time!!')

        //
        let output = []
        if (debug) console.log(tag, 'supportedCoins', supportedCoins)
        // 1 call per coins
        let coins
        if (!coin) {
            coins = await get_coins()
        } else {
            coins = [coin]
        }

        for (let i = 0; i < coins.length; i++) {
            let coin = coins[i]
            coin = coin.toUpperCase()
            if (supportedCoins.indexOf(coin) >= 0) {
                if (debug) console.log(tag, 'supported coin: ', coin)
                let results = await get_withdrawal_history(coin, start, end)
                results = results.result
                if (debug) console.log(tag, 'results: ', results)
                for (let i = 0; i < results.length; i++) {
                    let entry = results[i]
                    if (entry.status) entry.exchangeStatus = entry.status
                    entry.complete = false
                    entry.exchange = exchangeName
                    entry.coin = entry.currency
                    entry.timestamp = parseFloat(entry.timestamp)
                    if (entry.status == 'COMPLETED') entry.complete = true
                    if (entry.type == 'WITHDRAWAL') entry.withdrawal = true
                    if (entry.type == 'DEPOSIT') entry.deposit = true

                    if (entry.description) {
                        let txid
                        if (entry.description.indexOf(',') > -1) {
                            txid = normalize_description(entry.description)
                        } else {
                            txid = entry.description
                            txid = txid.trim()
                        }

                        if (!txid) {
                            console.error(tag, '1 failed to find txid!  raw: ', entry.description)
                        } else if (txid === 'txid') {
                            console.error(tag, '2 failed to find txid! raw: ', entry.description)
                        } else if (txid == entry.address) {

                            // entry.txid = data
                            // jerry riggin it, not an error now TODO parse better
                            // console.error(tag,"3 failed to find txid! raw: ",entry, "txid: ",txid, "address: ",entry.address)
                        } else if (txid.length < 10) {
                            console.error(tag, '4 failed to find txid! txid: ', txid, ' raw: ', entry.description)
                        } else {
                            entry.txid = txid
                        }

                        // if(!txidData || txidData[1]) console.error(tag,"unknown data format! ",data)
                    }
                    if (!entry.txid) entry.txid = entry.id.toString()
                    if (!entry.complete) entry.status = 'waiting on exchange action'
                    output.push(entry)
                }

                if (coins.length > 1) await pause(1)
            }
        }

        return output
    } catch (e) {
        console.error(tag, 'error: ', e)
        throw (e)
    }
}

const normalize_description = function (input) {
    let debug = false
    let tag = TAG + ' | normalize_description | '
    if (debug) console.log(tag, 'input: ', input)

    let data1 = input.split(',')[1]
    if (debug) console.log(tag, 'data1: ', data1)

    let txid
    if (data1.indexOf(':') > -1) {
        let data2 = data1.split(':')
        if (debug) console.log(tag, 'data2: ', data2)

        txid = data2[1]
        if (debug) console.log(tag, 'txid: ', txid)
    } else {
        txid = data1.trim()
    }

    return txid
}

const get_trade_history = function (coin, start, stop) {
    const tag = exchangeName + ' | get_trade_history | '
    const d = when.defer()
    const debug = true

    start = start / 1000
    start = start.toString()
    stop = stop / 1000
    stop = stop.toString()

    if (debug) console.log(tag, 'coin: ', coin)
    if (debug) console.log(tag, 'start: ', start)
    if (debug) console.log(tag, 'stop: ', stop)

    client.tradesByTime(coin, start, stop, function (err, result) {
        if (err) {
            console.error(tag, 'err: ', err)
            return d.reject(err)
        }
        if (result) {
            if (debug) console.log(tag, 'result: ', result)
            // const output = {}
            // output.success = true
            // output.result = result
            d.resolve(result)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_history = function (coin, start, stop) {
    const tag = exchangeName + ' | get_history | '
    const d = when.defer()
    const debug = false
    coin = coin.toLowerCase()

    if (debug) console.log(tag, 'debug: ', debug)

    client.movementsByTime(coin, start, stop, function (err, result) {
        if (err) {
            console.error(tag, 'err: ', err)
            return d.reject(err)
        }
        if (result) {
            const output = {}
            output.success = true
            output.result = result
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_withdrawal_history = function (coin, start, end) {
    const tag = exchangeName + ' | get_withdrawal_history | '
    const d = when.defer()
    const debug = true
    coin = coin.toLowerCase()

    if (debug) console.log(tag, 'debug: ', debug)
    start = start / 1000
    end = end / 1000
    start = Math.abs(start)
    end = Math.abs(end)
    start = start.toString()
    end = end.toString()

    if (debug) console.log(tag, 'start: ', start)
    if (debug) console.log(tag, 'end: ', end)

    client.movementsByTime(coin, start, end, function (err, result) {
        if (err) {
            console.error(tag, 'err: ', err)
            return d.reject(err)
        }
        if (result) {
            const output = {}
            output.success = true
            output.result = result
            d.resolve(output)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

/*

"bitcoin", "litecoin", "ethereum", "ethereumc", "tetheruso", "tetheruse", "wire", "zcash", "monero", "dash", "ripple", "iota", "eos", "santiment", "omisego", "bcash", "neo", "metaverse", "qtum", "aventus", "eidoo", "bgold", "datacoin", "qash", "yoyow", "golem", "status", "bat", "mna", "fun", "zrx", "tnb", "spk", "trx", "rcn", "rlc", "aid", "sng", "rep", "elf", "nec", "ios", "aio", "req", "rdn", "lrc", "wax", "dai", "cfi", "agi", "bft", "mtn", "ode", "ant", "dth", "mit", "stj", "xlm", "xvg", "bci", "mkr", "ven", "knc", "poa", "evt", "lym", "utk", "vee", "dad", "ors", "auc", "poy", "fsn", "cbt", "zcn", "sen", "nca", "cnd", "ctx", "pai", "see", "ess", "atd", "add", "mto", "atm", "hot", "dta", "iqx", "wpr", "zil", "bnt", "abs", "xra", "man", "xtz"

 */

const submit_withdrawal = async function (coin, amount, address) {
    const tag = exchangeName + ' | submit_withdrawal | '
    const d = when.defer()
    const currency = coin.toUpperCase()
    // console.log(tag,"currency: ",currency)
    // console.log(tag,"amount: ",amount)
    // console.log(tag,"address: ",address)
    // withdraw_type, walletselected, amount, address, cb
    let withdrawlCurrency
    if (currency === 'BTC') withdrawlCurrency = 'bitcoin'
    if (currency === 'LTC') withdrawlCurrency = 'litecoin'
    if (currency === 'ETH') withdrawlCurrency = 'ethereum'
    if (currency === 'ETC') withdrawlCurrency = 'ethereumc'
    if (currency === 'USDT') withdrawlCurrency = 'tetheruse'
    if (currency === 'XMR') withdrawlCurrency = 'monero'
    if (currency === 'ZEC') withdrawlCurrency = 'zcash'
    if (currency === 'DASH') withdrawlCurrency = 'dash'
    if (currency === 'XRP') withdrawlCurrency = 'ripple'
    if (currency === 'EOS') withdrawlCurrency = 'eos'
    //if (currency === 'BCH') withdrawlCurrency = 'bcash'
    if (currency === 'BCH') withdrawlCurrency = 'bab'
    if (currency === 'MANA') withdrawlCurrency = 'mna'
    if (currency === 'DGB') withdrawlCurrency = 'dgb'


    if (currency === 'OMG') withdrawlCurrency = 'omisego'
    if (currency === 'NEO') withdrawlCurrency = 'neo'
    if (currency === 'BTG') withdrawlCurrency = 'bgold'
    if (currency === 'BSV') withdrawlCurrency = 'Bitcoin SV'
    if (currency === 'MKR') withdrawlCurrency = 'mkr'
    if (currency === 'DAI') withdrawlCurrency = 'Dai Stablecoin'

    // get max amount by coin
    let maxSend = await redBack.get('rules:maxSend:bitfinex:' + currency)
    if (maxSend) maxSend = parseInt(maxSend)
    if (maxSend && maxSend < amount) amount = maxSend
    amount = amount.toString()

    let output = {}
    output.success = false
    console.log("withdrawlCurrency:", withdrawlCurrency)
    console.log("amount:", amount)
    console.log("address:", address)
	
    if (withdrawlCurrency) {
        client.withdraw(withdrawlCurrency, 'exchange', amount, address, function (err, resp) {
            if (err) {
                console.error(tag, err, resp)
                output.error = err
                d.resolve(output)
            } else {
                console.error(tag, 'Response: ', resp)
                if (typeof (resp) === 'string') resp = JSON.parse(resp)
                if (resp[0])resp = resp[0]
                if (resp.status === 'error') {
                    output.error = resp.message
                    d.resolve(output)
                } else {
                    output.success = true
                    output.msg = resp.message
                    output.id = resp.withdrawal_id
                    output.fees = resp.fees
                    d.resolve(output)
                }
            }
        })
    } else {
        output.error = 'Unknown name for currency:' + currency
        d.resolve(output)
    }

    return d.promise
}

const pause = function (length) {
    const d = when.defer()
    const done = function () { d.resolve(true) }
    setTimeout(done, length * 1000)
    return d.promise
}

const get_coins = async function () {
    let tag = TAG + ' | get_coins | '
    try {
        // let staging have more coins
        let env = process.env.ENVIRONMENT || 'local'
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

/*******************************************
// Rippers
//******************************************/

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

let digest_transfer_history = async function (dataChunk, exchange) {
    let tag = TAG + ' | digest_transfer_history | '
    let debug = false
    try {
        if (debug) console.log(tag, 'dataChunk: ', dataChunk)
        // if(debug) console.log(tag,"coin: ",coin)
        if (debug) console.log(tag, 'exchange: ', exchange)

        for (let i = 0; i < dataChunk.length; i++) {
            let entry = dataChunk[i]
            if (debug) console.log(tag, 'id: ', entry.id)
            // save raw entry to db
            entry.timestamp = parseFloat(entry.timestamp)
            try {
                // if contains txid
                if (entry.txid && entry.txid.length > 39) {
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
                // if (debug) console.error(tag,"error: ",e)
            }
        }
    } catch (e) {
        // off to ignore duplicate keys
        if (debug) console.error(tag, 'error: ', e)
    }
}

let digest_trade_history = async function (dataChunk, exchange) {
    let tag = TAG + ' | digest_trade_history | '
    let debug = true
    try {
        if (debug) console.log(tag, 'dataChunk: ', dataChunk)
        // if(debug) console.log(tag,"coin: ",coin)
        if (debug) console.log(tag, 'exchange: ', exchange)

        for (let i = 0; i < dataChunk.length; i++) {
            let entry = dataChunk[i]
            if (debug) console.log(tag, 'entry: ', entry)
            // save raw entry to db
            entry.timestamp = parseFloat(entry.timestamp)
            try {
                // if contains txid

            } catch (e) {
                // if (debug) console.error(tag,"error: ",e)
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
        output.exchange = exchangeName
        output.transfers = []

        let batch = await build_intervial_batch(start, end, intervial)
        if (debug) console.log(tag, 'batch: ', batch)
        // try first intervial
        // if limit, rebatch with higher interval

        // for each exchange
        // let exchangeNames = Object.keys(exchanges)
        let exchangeNames = ['bitfinex']
        // let coins = ["BTC","USDT", "LTC", "ETH", "ETC","XMR", "ZEC","DASH","XRP", "EOS","BCH", "OMG"]
        // let coins = ["LTC"]

        start = start / 1000
        end = end / 1000

        let latest = 0
        let earliest = 0

        let coins = get_coins_config('bitfinex')
        for (let i = 0; i < exchangeNames.length; i++) {
            let exchange = exchangeNames[i]
            // for each batch chunk
            for (let j = 0; j < coins.length; j++) {
                let coin = coins[j]
                console.log(tag, 'coin: ', coin)
                // for each coin
                for (let k = 0; k < batch.length; k++) {
                    let intervial = batch[k]
                    let dataChunk = await get_transfer_history(coin, intervial[0], intervial[1])
                    if (debug) console.log(tag, 'dataChunk: ', dataChunk.length)
                    // if(debug) console.log(tag,"dataChunk: ",dataChunk)

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

let trade_history_rip = async function (start, end, intervial) {
    let tag = TAG + ' | transfer_history_rip | '
    let debug = true
    try {
        let output = {}
        output.exchange = exchangeName
        output.trades = []

        let batch = await build_intervial_batch(start, end, intervial)
        if (debug) console.log(tag, 'batch: ', batch)
        // try first intervial
        // if limit, rebatch with higher interval

        start = start / 1000
        end = end / 1000

        // for each exchange
        // let exchangeNames = Object.keys(exchanges)
        let exchangeNames = ['bitfinex']
        // let coins = ["BTC","USDT", "LTC", "ETH", "ETC","XMR", "ZEC","DASH","XRP", "EOS","BCH", "OMG"]
        // let coins = ["LTC"]

        let latest = 0
        let earliest = 0

        let coins = get_coins_config('bitfinex')
        for (let i = 0; i < exchangeNames.length; i++) {
            let exchange = exchangeNames[i]
            // for each batch chunk
            for (let j = 0; j < coins.length; j++) {
                let coin = coins[j]
                console.log(tag, 'coin: ', coin)
                // for each coin
                if (coin !== 'BTC') {
                    for (let k = 0; k < batch.length; k++) {
                        let intervial = batch[k]

                        let market = coin + 'BTC'
                        let dataChunk = await get_trade_history(market, intervial[0], intervial[1])
                        if (debug) console.log(tag, 'dataChunk: ', dataChunk.length)
                        if (debug) console.log(tag, 'dataChunk: ', dataChunk)

                        for (let k = 0; k < dataChunk.length; k++) {
                            // if inside time range, add
                            let time = dataChunk[k].timestamp
                            if (debug) console.log(tag, 'time: ', time)
                            if (debug) console.log(tag, 'time: ', new Date(time * 1000).toString())
                            if (time > latest) latest = time
                            if (time < earliest || earliest === 0) earliest = time
                            if (time < end && time > start) {
                                output.trades.push(dataChunk[k])
                            } else {
                                if (debug) console.error(tag, 'time (OUT OF RANGE!): ', time)
                                if (debug) console.error(tag, 'time: (OUT OF RANGE!)', new Date(time * 1000).toString())
                            }
                        }

                        // digest data
                        let success = await digest_transfer_history(dataChunk, exchange)
                        // pause
                        await pause(1)
                    }
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
        // coins.push("BTC")
        return coins
    } catch (e) {
        console.error(tag, 'e: ', e)
    }
}
