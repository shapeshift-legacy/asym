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

// Kracken

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
const kraken = require('kraken-api')
const co = require('co')

const TAG = ' | kraken-client | '

const when = require('when')
// const Big = require('big');
// const log = require('./../log.js')

// const fx = require("money")
const _ = require('underscore')
const Redis = require('then-redis')

const config = require('../config')
// console.log("pub: ",secret.kraken.pub)
// console.log("priv: ",secret.kraken.priv)
const client = new kraken(config.EXCHANGES_CONFIG.Credentials.kraken.pub, config.EXCHANGES_CONFIG.Credentials.kraken.priv)

//
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const monk = require('monk')
const db = monk(config.MONGO_URI)

let dbs = {}
let exchange = 'kraken'
dbs['internalTransactions'] = db.get('internalTransactions')
dbs[exchange + 'Trades'] = db.get(exchange + 'Trades')
dbs[exchange + 'Withdrawals'] = db.get(exchange + 'Withdrawals')
dbs[exchange + 'Deposits'] = db.get(exchange + 'Deposits')
// indexes
dbs['internalTransactions'].ensureIndex({ txid: 1 }, { unique: true })
dbs[exchange + 'Trades'].ensureIndex({ ordertxid: 1 }, { unique: true })
dbs[exchange + 'Withdrawals'].ensureIndex({ id: 1 }, { unique: true })
dbs[exchange + 'Deposits'].ensureIndex({ txid: 1 }, { unique: true })

//* ********************************
//        Globals
//* ********************************
const exchangeName = 'kraken'
let supportedCoins = config.EXCHANGES_CONFIG.ExchangePairs.alts[exchangeName]
supportedCoins.push('BTC')
const market_ids = {}

//* ********************************
//         Module
//* ********************************

module.exports = {
    name: function () {
        return exchangeName
    },
    balances: function () {
        return get_balances()
    },
    withdrawal: function (coin, amount, destination) {
        return withdrawal_coin(coin, amount, destination)
    },
    transferHistory: function (coin) {
        return get_transfer_history(coin)
    },
    withdrawalHistory: function (coin) {
        return get_withdrawal_history(coin)
    },
    depositHistory: function (coin) {
        return get_deposit_history(coin)
    },
    tradeHistory: function (start, end) {
        return get_trade_history(start, end)
    },
    history: function () {
        return get_order_history()
    },
    bid: function (pair, rate, amount) {
        return post_bid(pair, rate, amount)
    },
    ask: function (pair, rate, amount) {
        return post_ask(pair, rate, amount)
    },
    tradeHistoryRip: function (start, end, interval) {
        return trade_history_rip(start, end, interval)
    },
    transferHistoryRip: function (start, end, interval) {
        return transfer_history_rip(start, end, interval)
    },

}

//* *******************************
// function primary
//* *******************************

const get_transfer_history = async function (coin) {
    const tag = exchangeName + ' | get_transfer_history | '
    const debug = true
    try {
        // if !coin assume all online coins
        // if(!coin)

        // if no start/end assume 24hours

        //
        let output = []
        if (debug) console.log(tag, 'checkpoint1')
        if (debug) console.log(tag, 'coin: ', coin)
        // 1 call per coins
        let coins
        if (!coin) {
            coins = await redBack.smembers('autoBalance:coins')
        } else {
            coins = [coin]
        }
        if (debug) console.log(tag, 'coins: ', coins)
        for (let i = 0; i < coins.length; i++) {
            let coin = coins[i]
            coin = coin.toUpperCase()
            //
            // if(supportedCoins.indexOf(coin) >=0 ){
            let deposits = await get_deposit_history(coin)
            if (debug) console.log(tag, 'deposits: ', deposits)
            let withdrawals = await get_withdrawal_history(coin)
            if (debug) console.log(tag, 'withdrawals: ', withdrawals)

            // normalize
            deposits = deposits.result
            withdrawals = withdrawals.result
            for (let i = 0; i < deposits.length; i++) {
                // normalize
                let entry = deposits[i]
                entry.type = 'DEPOSIT'
                entry.deposit = true
                entry.coin = coin
                entry.id = entry.txid
                entry.alias = entry.Currency
                entry.exchange = exchangeName
                entry.timestamp = entry.time
                if (entry.status == 'Success') {
                    entry.complete = true
                } else {
                    entry.complete = false
                }
                if (!entry.complete) entry.status = 'incomplete'

                if (debug) console.log(tag, ' Entry before insert!!! ', entry)
                output.push(entry)
            }

            for (let i = 0; i < withdrawals.length; i++) {
                let entry = withdrawals[i]
                if (debug) console.log(tag, '* entry: ', entry)
                if (debug) console.log(tag, '* refid: ', entry.refid)
                entry.id = entry.refid
                if (debug) console.log(tag, '* id: ', entry.id)
                entry.type = 'WITHDRAWAL'
                entry.exchange = exchangeName
                entry.withdrawal = true
                entry.coin = coin
                entry.alias = entry.Currency
                entry.timestamp = entry.time
                if (!entry.txid) entry.txid = entry.refid
                if (entry.status == 'Success') {
                    entry.complete = true
                } else {
                    entry.complete = false
                }
                if (!entry.complete) entry.status = 'incomplete'
                if (debug) console.log(tag, ' Entry before insert!!! ', entry)
                output.push(entry)
            }

            // pause(5)
            // }
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

    if (coin) coin = coin.toUpperCase()

    let currency
    if (coin === 'BTC') currency = 'XXBT'
    if (coin === 'LTC') currency = 'XLTC'
    if (coin === 'DOGE') currency = 'XDG'
    if (coin === 'ETH') currency = 'ETH'
    if (coin === 'REP') currency = 'XREP'
    if (coin === 'ICN') currency = 'XICN'
    if (coin === 'MLN') currency = 'XMLN'
    if (!currency) currency = 'X' + coin

    console.log(tag, 'currency: ', currency)
    client.api('DepositStatus', { asset: currency }, function (err, result) {
        console.log(err, result)
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            let deposits = result.result
            const output = {}
            output.success = true
            output.result = deposits
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

    if (coin) coin = coin.toUpperCase()

    let currency
    if (coin === 'BTC') currency = 'XXBT'
    if (coin === 'LTC') currency = 'XLTC'
    if (coin === 'DOGE') currency = 'XDG'
    if (coin === 'ETH') currency = 'ETH'
    if (coin === 'REP') currency = 'XREP'
    if (coin === 'ICN') currency = 'XICN'
    if (coin === 'MLN') currency = 'XMLN'
    if (coin === 'USDC') currency = 'USDC'
    if (!currency) currency = 'X' + coin

    console.log(tag, 'currency: ', currency)
    client.api('WithdrawStatus', { asset: currency }, function (err, result) {
        // console.log(err, result)
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
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

const withdrawal_coin = function (coin, amount, address) {
    const tag = exchangeName + ' | submit_withdrawal | '
    const d = when.defer()
    coin = coin.toUpperCase()
    let currency
    if (coin === 'BTC') currency = 'XXBT'
    if (coin === 'LTC') currency = 'XLTC'
    if (coin === 'DOGE') currency = 'XDG'
    if (coin === 'ETH') currency = 'ETH'
    if (coin === 'GNO') currency = 'GNO'
    if (coin === 'SC') currency = 'SC'
    if (coin === 'ZEC') currency = 'ZEC'
    if (coin === 'DASH') currency = 'DASH'
    if (coin === 'BAT') currency = 'BAT'
    if (coin === 'REP') currency = 'XREP'
    if (coin === 'ICN') currency = 'XICN'
    if (coin === 'MLN') currency = 'XMLN'
    if (coin === 'ATOM') currency = 'ATOM'
    if (coin === 'USDC') currency = 'USDC'
    if (coin === 'BCH') currency = 'BCH'
    if (coin === 'DAI') currency = 'DAI'
    if (coin === 'LINK') currency = 'LINK'
    if (coin === 'PAXG') currency = 'PAXG'
    if (!currency) currency = 'X' + coin

    console.log(tag, 'currency: ', currency)
    console.log(tag, 'amount: ', amount)
    console.log(tag, 'amount: ', typeof (amount))
    // amount = amount.toString()
    // console.log(tag,"amount: ",amount)
    // console.log(tag,"amount: ",typeof(amount))
    console.log(tag, 'address: ', address)
    // console.log(client)

    // keymap
    const keymap = {
        BTC: 'BTC Main Address 11/6/19',
        BAT: 'BAT Main Address 11/7/19',
        USDT: 'USDT Withdraw Main 2017.04.06',
        LTC: 'LTC Main Address 11/6/19',
        ETH: 'Eth Withdraw Main 2017.04.06',
        DASH: 'DASH Main Address 11/7/19',
        SC: 'SIA Main Address 11/11/19',
        XRP: 'XRP Main Withdraw 2017.04.07',
        ETC: 'ETC Main Withdraw 2017.06.06',
        DOGE: 'Doge Main Withdraw 2017.04.07',
        REP: 'Rep Main Withdraw 2017.04.06',
        ZEC: 'ZEC Main Address 11/6/19',
        ICN: 'ICN Main 2017.04.06',
        DAI: 'DAI Hot',
        MLN: 'MLN Main Withdraw 2017.04.06',
        XMR: 'XMR Main Withdraw 2017.04.07',
        GNO: 'GNO Main Address 11/6/19',
        LINK: 'LINK Hot',
        PAXG: 'PAXG Hot',
        ATOM: 'ATOM Hot',
        BCH: 'bch hot converted',
        USDC: 'USDC'
    }

    const key = keymap[coin]
    console.log(tag, 'key: ', key)

    let output = {}
    output.success = false

    if (key) {
        client.api('Withdraw', { asset: currency, amount, key }, function (err, resp) {
            if (err) {
                console.error(tag, err, resp)
                output.error = err.toString()
                d.resolve(output)
            } else {
                console.error(tag, 'Responce: ', resp)
                if (resp.result.refid) {
                    output.success = true
                    output.id = resp.result.refid
                    d.resolve(output)
                } else {
                    output.error = resp
                    d.resolve(output)
                }
            }
        })
    } else {
        output.error = 'Key missing from keymap!!!'
        d.resolve(output)
    }

    return d.promise
}

let normalize_trades = function (input) {
    let tag = TAG + ' | normalize_trades | '
    let debug = true

    let output = []
    let corpus = input.trades

    for (let key in corpus) {
        if (corpus.hasOwnProperty(key)) {
            // console.log(key + " -> " + p[key]);
            output.push(corpus[key])
        }
    }
    return output
}

const get_trade_history = function (start, end) {
    const tag = exchangeName + ' | get_trade_history | '
    const d = when.defer()
    let debug = true
    start = start / 1000
    end = end / 1000

    if (debug) console.log(tag, 'start: ', start)
    if (debug) console.log(tag, 'end: ', end)

    client.api('TradesHistory', { start: start, end: end }, function (err, resp) {
        if (err) {
            return d.reject(err)
        }
        if (resp) {
            if (debug) console.log(tag, 'resp: ', resp)

            let trades = normalize_trades(resp.result)

            //
            // const output = {}
            // output.success = true
            // output.result = result
            d.resolve(trades)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })
    return d.promise
}

/*
 pair = asset pair
 type = type of order (buy/sell)
 ordertype = order type:
 market
 limit (price = limit price)
 stop-loss (price = stop loss price)
 take-profit (price = take profit price)
 stop-loss-profit (price = stop loss price, price2 = take profit price)
 stop-loss-profit-limit (price = stop loss price, price2 = take profit price)
 stop-loss-limit (price = stop loss trigger price, price2 = triggered limit price)
 take-profit-limit (price = take profit trigger price, price2 = triggered limit price)
 trailing-stop (price = trailing stop offset)
 trailing-stop-limit (price = trailing stop offset, price2 = triggered limit offset)
 stop-loss-and-limit (price = stop loss price, price2 = limit price)
 settle-position
 price = price (optional.  dependent upon ordertype)
 price2 = secondary price (optional.  dependent upon ordertype)
 volume = order volume in lots
 leverage = amount of leverage desired (optional.  default = none)
 oflags = comma delimited list of order flags (optional):
 viqc = volume in quote currency (not available for leveraged orders)
 fcib = prefer fee in base currency
 fciq = prefer fee in quote currency
 nompp = no market price protection
 post = post only order (available when ordertype = limit)
 starttm = scheduled start time (optional):
 0 = now (default)
 +<n> = schedule start time <n> seconds from now
 <n> = unix timestamp of start time
 expiretm = expiration time (optional):
 0 = no expiration (default)
 +<n> = expire <n> seconds from now
 <n> = unix timestamp of expiration time
 userref = user reference id.  32-bit signed number.  (optional)
 validate = validate inputs only.  do not submit order (optional)

 optional closing order to add to system when order gets filled:
 close[ordertype] = order type
 close[price] = price
 close[price2] = secondary price

 */

const post_bid = function (pair, rate, amount) {
    const tag = exchangeName + ' | post_bid | '
    const d = when.defer()

    console.log(tag, 'rate : ', rate)
    console.log(tag, 'amount : ', amount)

    let coins = pair.split('_')

    console.log(tag, 'coins : ', coins)

    let coin1 = normalize_coin(coins[0])
    let coin2 = normalize_coin(coins[1])
    console.log(tag, 'coin1 : ', coin1)
    console.log(tag, 'coin2 : ', coin2)

    let params = {}
    params.pair = coin2 + coin1
    params.price = rate
    params.volume = amount
    params.ordertype = 'limit'
    params.type = 'buy'

    console.log(tag, 'params : ', params)

    client.api('AddOrder', params, function (error, result) {
        if (error) {
            console.error(tag, ' Error: ', error)
        } else {
            console.log(tag, ' resp: ', result)
            d.resolve(result)
        }
    })
    return d.promise
}

// const post_ask = function(pair,  rate,amount){
//     const tag = exchangeName+" | post_buy | "
//     const d = when.defer();
//
//     client.api(krakenPair[0],krakenPair[1], rate, amount, function(error, result) {
//         if (error) {
//             console.error(tag, " Error: ", error)
//         } else {
//             console.log(tag, " resp: ", result)
//         }
//     });
//     return d.promise
// }
//

const normalize_coin = function (coin) {
    let output = {}
    let debug = false
    if (debug) console.log(input)

    // translate to non-kraken
    let currency

    if (coin === 'BTC') currency = 'XXBT'
    if (coin === 'LTC') currency = 'XLTC'
    if (coin === 'DOGE') currency = 'XDG'
    if (coin === 'ETH') currency = 'ETH'
    if (coin === 'REP') currency = 'XREP'
    if (coin === 'ICN') currency = 'XICN'
    if (coin === 'MLN') currency = 'XMLN'
    if (coin === 'BCH') currency = 'BCH'
    if (coin === 'XMR') currency = 'XXMR'

    return currency
}

const normalize = function (input) {
    let output = {}
    let debug = false
    if (debug) console.log(input)
    let coins = Object.keys(input)
    for (let i = 0; i < coins.length; i++) {
        let coin = coins[i]
        // translate to non-kraken
        let currency
        if (coin === 'XXBT') currency = 'BTC'
        if (coin === 'XLTC') currency = 'LTC'
        if (coin === 'XDG') currency = 'DOGE'
        if (coin === 'XETH') currency = 'ETH'
        if (coin === 'XREP') currency = 'REP'
        if (coin === 'XICN') currency = 'ICN'
        if (coin === 'XMLN') currency = 'MLN'
        if (coin === 'BCH') currency = 'BCH'
        if (coin === 'XXMR') currency = 'XMR'

        output[currency] = input[coin]
    }

    return output
}

const get_balances = function () {
    const tag = exchangeName + ' | get_balances | '
    const d = when.defer()

    let attempt = function () {
        client.api('Balance', null, function (err, resp) {
            // console.error(tag,err,resp)
            if (err) {
                console.error(tag, err, resp)
                setTimeout(attempt, 300)
            } else {
                // console.log(tag,"Responce: ",resp)

                // normalize coin names
                let output = normalize(resp.result)

                d.resolve(output)
            }
        })
    }
    attempt()

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
// const initialize_kraken = co.wrap(function* () {
//     const tag = " | initialize_kraken | "
//     const time = Date().getTime()
//
//     // sub to kraken
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
        if (debug) console.log(tag, 'intervials: ', intervials)

        return intervials
    } catch (e) {
        console.error(tag, 'error: ', e)
    }
}

let digest_transfer_history = async function (dataChunk, exchange) {
    let tag = TAG + ' | digest_transfer_history | '
    let debug = true
    try {
        if (debug) console.log(tag, 'dataChunk: ', dataChunk.length)
        if (debug) console.log(tag, 'dataChunk(first): ', dataChunk[0])
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
                if (debug) console.error(tag, 'error: ', e, ' entry: ', entry)
            }
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
        if (debug) console.log(tag, 'dataChunk(first): ', dataChunk[0])
        // if(debug) console.log(tag,"coin: ",coin)
        if (debug) console.log(tag, 'exchange: ', exchange)

        for (let i = 0; i < dataChunk.length; i++) {
            let entry = dataChunk[i]
            if (debug) console.log(tag, 'entry: ', entry)
            // save raw entry to db
            entry.timestamp = entry.time
            try {
                // if contains txid
                let success = await dbs[exchange + 'Trades'].insert(entry)

                //
            } catch (e) {
                // if (debug) console.error(tag,"error: ",e," entry: ",entry)
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

        // let batch = await build_intervial_batch(start,end,intervial)
        // if(debug) console.log(tag,"batch: ",batch)
        // try first intervial
        // if limit, rebatch with higher interval

        // for each exchange
        // let exchangeNames = Object.keys(exchanges)
        let exchangeNames = ['kraken']
        let coins = [ 'BTC', 'LTC' ]
        // let coins = get_coins_config('kraken')

        start = start / 1000
        end = end / 1000

        let latest = 0
        let earliest = 0

        for (let j = 0; j < coins.length; j++) {
            let coin = coins[j]
            // for each coin
            console.log(tag, 'coin:', coin)
            let dataChunk = await get_transfer_history(coin)
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

        // for each exchange
        // let exchangeNames = Object.keys(exchanges)
        let exchangeNames = ['kraken']

        start = start / 1000
        end = end / 1000

        let latest = 0
        let earliest = 0

        for (let i = 0; i < exchangeNames.length; i++) {
            let exchange = exchangeNames[i]
            // for each batch chunk
            for (let k = 0; k < batch.length; k++) {
                let interval = batch[k]

                let dataChunk = await get_trade_history(interval[0], interval[1])
                if (debug) console.log(tag, 'dataChunk: ', dataChunk.length)
                if (debug) console.log(tag, 'dataChunk: ', dataChunk)

                for (let k = 0; k < dataChunk.length; k++) {
                    // if inside time range, add
                    dataChunk[k].timestamp = dataChunk[k].time
                    let time = dataChunk[k].timestamp
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

const pause = function (length) {
    const d = when.defer()
    const done = function () { d.resolve(true) }
    setTimeout(done, length * 1000)
    return d.promise
}
