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

// binance

//                              - modularized Client
//* *******************************************************

/*

    Notes: Binance is really sensitive to market info. Min step size and tick size.

    It is recommended to validate every order being placed and adjust.

    Errors:
        "Filter failure: PRICE_FILTER"

    CoinInfo

    resp:  { symbol: 'TRXBTC',
      status: 'TRADING',
      baseAsset: 'TRX',
      baseAssetPrecision: 8,
      quoteAsset: 'BTC',
      quotePrecision: 8,
      orderTypes:
       [ 'LIMIT',
         'LIMIT_MAKER',
         'MARKET',
         'STOP_LOSS_LIMIT',
         'TAKE_PROFIT_LIMIT' ],
      icebergAllowed: true,
      filters:
       [ { filterType: 'PRICE_FILTER',
           minPrice: '0.00000001',
           maxPrice: '100000.00000000',
           tickSize: '0.00000001' },
         { filterType: 'LOT_SIZE',
           minQty: '1.00000000',
           maxQty: '90000000.00000000',
           stepSize: '1.00000000' },
         { filterType: 'MIN_NOTIONAL', minNotional: '0.00200000' } ] }
 */

//* ********************************
//        Requires
//* ********************************
require('when/monitor/console')
const api = require('binance')

const when = require('when')
// const Big = require('big');
// const log = require('./../log.js')

// const fx = require("money")
const _ = require('underscore')

const config = require('../config')
// console.log("config: ",config)
// console.log("pri: ",secret.binance.pri)

// let accounts = Object.keys(config.api)
// let clients = {}
// for(let i = 0; i < accounts; i++){
//     let account = accounts[i]
//     clients[account] = new binance(config.EXCHANGES_CONFIG.Credentials.binance.pub, config.EXCHANGES_CONFIG.Credentials.binance.pri);
// }

let TAG = ' | binance-exchange | '

//* ********************************
//        Globals
//* ********************************
// uxAPI.setExchange("binance", client)
const exchangeName = 'binance'
// constants

// let supportedCoins = config.exchanges.ExchangePairs.alts[exchangeName]
// supportedCoins.push("BTC")
//* ********************************
//         Module
//* ********************************

let client = {}
module.exports = {
    // async
    // innitilize:function(account){
    //     console.log(TAG," account: ",account)
    //     client = new binance(config.EXCHANGES_CONFIG.Credentials.binance.pub, config.EXCHANGES_CONFIG.Credentials.binance.pri)
    //     client.user = account
    //     //console.log("***",client)
    // },
    name: function () {
        return exchangeName
    },
    // //promise
    // initialize: function() {
    //     return initialize_binance();
    // },
    coins: function () {
        return get_coins()
    },

    coinInfo: function (coin) {
        return get_coin_info(coin)
    },

    getTicker: function (market) {
        return get_ticker(market)
    },

    getSummary: function () {
        return get_Summary()
    },
    address: function (account, coin) {
        return get_new_address(account, coin)
    },
    addresses: function () {
        return get_addresses()
    },
    cancel: function (orderId, symbol, account) {
        return cancel_order(orderId, symbol, account)
    },

    //
    // run: function() {
    //     return run_binance();
    // },
    //
    // status: function() {
    //     return get_binance_status();
    // },
    //
    // getpairs: function() {
    //     return get_all_pairs();
    // },
    //
    balances: function (account) {
        return get_balances(account)
    },

    ordersOpen: function (account) {
        return get_open_orders(account)
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

    withdrawalHistory: function (coin) {
        return get_withdrawal_history(coin)
    },

    depositHistory: function (coin) {
        return get_deposit_history(coin)
    },

    bid: function (account, pair, rate, amount) {
        return post_bid(account, pair, rate, amount)
    },

    ask: function (account, pair, rate, amount) {
        return post_ask(account, pair, rate, amount)
    },

    bidMarket: function (pair, amount) {
        return post_bid_market(pair, amount)
    },

    askMarket: function (pair, amount) {
        return post_ask_market(pair, amount)
    }

}

/********************************
 //function primary
 //********************************/

const get_coin_info = function (coin) {
    const tag = exchangeName + ' | get_coins | '
    const d = when.defer()
    const debug = false
    if (debug) console.log(tag, 'checkpoint1')
    let account = 'bithighlander'
    client = new api.BinanceRest({
        key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
        secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
        disableBeautification: false
        /*
         * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
         * default those keys will be replaced with more descriptive, longer ones.
         */
    })

    let market = coin + 'BTC'

    client.exchangeInfo(function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            let output

            if (debug) console.log(tag, result)
            let info = result.symbols
            for (let i = 0; i < info.length; i++) {
                if (market === info[i].symbol) {
                    d.resolve(info[i])
                }
            }
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

const get_coins = function () {
    const tag = exchangeName + ' | get_coins | '
    const d = when.defer()
    const debug = false
    if (debug) console.log(tag, 'checkpoint1')
    let account = 'bithighlander'
    client = new api.BinanceRest({
        key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
        secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
        disableBeautification: false
        /*
         * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
         * default those keys will be replaced with more descriptive, longer ones.
         */
    })

    client.exchangeInfo(function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)

            d.resolve(result)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}
//
const cancel_order = function (orderId, symbol, account) {
    const tag = exchangeName + ' | cancel_order | '
    const d = when.defer()
    const debug = true
    if (debug) console.log(tag, 'checkpoint1')

    if (debug) console.log(tag, 'orderId: ', orderId)
    if (debug) console.log(tag, 'account: ', account)

    client = new api.BinanceRest({
        key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
        secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
        disableBeautification: false
        /*
         * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
         * default those keys will be replaced with more descriptive, longer ones.
         */
    })
    let order = { orderId, symbol }
    client.cancelOrder(order, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let data = result.result
            // let output = {}
            // output.address = data.Address
            d.resolve(result)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}
//
const get_open_orders = function (account) {
    const tag = exchangeName + ' | get_open_orders | '
    const d = when.defer()
    const debug = false
    if (debug) console.log(tag, 'checkpoint1')

    if (!config.EXCHANGES_CONFIG) throw Error('invalid account!! ' + account)

    client = new api.BinanceRest({
        key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
        secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
        disableBeautification: false
        /*
         * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
         * default those keys will be replaced with more descriptive, longer ones.
         */
    })

    let params = {
        timestamp: new Date().getTime()
    }

    client.openOrders(params, function (err, result) {
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            d.resolve(result)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}
//
// const get_new_address = function(account, coin){
//     const tag = exchangeName+" | get_new_address | "
//     const d = when.defer();
//     coin = coin.toUpperCase()
//     const debug = true
//     if(debug) console.log(tag,"checkpoint1")
//     client = new binance(config.EXCHANGES_CONFIG.Credentials.binance.pub, config.EXCHANGES_CONFIG.Credentials.binance.pri)
//     client.getdepositaddress(coin,function(err, result) {
//         if (err) {
//             return d.reject("balances|" + err)
//         }
//         if(result){
//             if(debug) console.log(tag,result)
//             let data = result.result
//             //let output = {}
//             //output.address = data.Address
//             d.resolve(result)
//         } else {
//             console.error(tag," ERROR: ",result)
//         }
//     })
//
//     return d.promise
// }
//
// const get_addresses = function(){
//     const tag = exchangeName+" | get_addresses | "
//     const d = when.defer();
//     const debug = false
//     if(debug) console.log(tag,"checkpoint1")
//     client.getbalances(function(err, result) {
//         if (err) {
//             return d.reject("balances|" + err)
//         }
//         if(result){
//             if(debug) console.log(tag,result)
//             let data = result.result
//             let output = {}
//
//             for(let i = 0; i < data.length; i++){
//                 let entry = data[i]
//                 output[entry.Currency] = entry.CryptoAddress
//             }
//
//             d.resolve(output)
//         } else {
//             console.error(tag," ERROR: ",result)
//         }
//     })
//
//     return d.promise
// }
//

const pause = function (length) {
    const d = when.defer()
    const done = function () { d.resolve(true) }
    setTimeout(done, length * 1000)
    return d.promise
}

const get_Summary = async function () {
    const tag = exchangeName + ' | get_Summary | '
    const d = when.defer()
    const debug = true
    let account = 'bithighlander'
    try {
        client = new api.BinanceRest({
            key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
            secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
            timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
            recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
            disableBeautification: false
            /*
             * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
             * default those keys will be replaced with more descriptive, longer ones.
             */
        })

        // get all pairs
        let result = await client.allPrices()
        // if(debug) console.log(tag,"result: ",result)
        let allPairs = []
        for (let i = 0; i < result.length; i++) {
            let market = result[i].symbol
            // if(debug) console.log(tag,"market: ",market)
            // filer by btc base
            if (market.indexOf('BTC') >= 0 && market != 'BTCUSDT') {
                allPairs.push(market)
            }
        }
        if (debug) console.log(tag, 'allPairs: ', allPairs.length)

        let output = []
        // get info on all pairs
        for (let i = 0; i < allPairs.length; i++) {
            if (debug) console.log(tag, 'pair: ' + allPairs[i] + ' i: ', allPairs.length - i)
            let marketInfo = await client.ticker24hr(allPairs[i])
            // if(debug) console.log(tag,"marketInfo: ",marketInfo)
            output.push(marketInfo)
            await pause(0.05)
        }
        // let result = await client.ticker24hr("ETHBTC")
        // if(debug) console.log(tag,"result: ",result)

        return output
    } catch (e) {
        console.error(tag, e)
    }
}

const get_Summary_legacy = function () {
    const tag = exchangeName + ' | get_Summary | '
    const d = when.defer()
    const debug = true
    let account = 'bithighlander'
    client = new api.BinanceRest({
        key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
        secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
        disableBeautification: false
        /*
         * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
         * default those keys will be replaced with more descriptive, longer ones.
         */
    })

    client.ticker24hr('ETHBTC', function (err, result) {
        // if(debug) console.log(tag,err,result)
        if (err) {
            return d.reject('balances|' + err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let withdrawals = result.result
            // const output = {}
            // output.success = true
            // output.result = withdrawals
            d.resolve(result)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}

//
const get_ticker = function (market) {
    const tag = exchangeName + ' | get_ticker | '
    const d = when.defer()
    const debug = true

    if (debug) console.log(tag, 'market: ', market)
    let account = 'bithighlander'
    client = new api.BinanceRest({
        key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
        secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
        disableBeautification: false
        /*
         * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
         * default those keys will be replaced with more descriptive, longer ones.
         */
    })

    client.ticker24hr(market, function (err, result) {
        if (err) {
            console.error(tag, err, result)
            return d.reject(err)
        }
        if (result) {
            if (debug) console.log(tag, result)
            let withdrawals = result.result
            // const output = {}
            // output.success = true
            // output.result = withdrawals
            d.resolve(result)
        } else {
            console.error(tag, ' ERROR: ', result)
        }
    })

    return d.promise
}
//
// const lookup_order = function(account,uuid){
//     const tag = exchangeName+" | lookup_order | "
//     const d = when.defer();
//     const debug = true
//
//     client = new binance(config.api['bithighlander'].binance.pub, config.api['bithighlander'].binance.pri)
//     client.getorder(uuid,function(err, result) {
//         if (err) {
//             return d.reject("balances|" + err)
//         }
//         if(result){
//             if(debug) console.log(tag,result)
//             let withdrawals = result.result
//             const output = {}
//             output.success = true
//             output.result = withdrawals
//             d.resolve(output)
//         } else {
//             console.error(tag," ERROR: ",result)
//         }
//     })
//
//     return d.promise
// }
//
// const get_transfer_history = async function(coin){
//     const tag = exchangeName+" | get_transfer_history | "
//     let debug = true
//     try{
//         //
//         let output = []
//
//         let deposits = await get_deposit_history(coin)
//         let withdrawals = await get_withdrawal_history(coin)
//
//         if(debug) console.log(tag,"deposits: ", deposits)
//         if(debug) console.log(tag,"withdrawals: ", withdrawals)
//
//         //normalize
//         deposits    = deposits.result
//         withdrawals = withdrawals.result
//
//         if(deposits){
//             for (let i = 0; i < deposits.length; i++) {
//                 //normalize
//                 let entry = deposits[i]
//                 entry.deposit = true
//                 entry.coin = entry.Currency
//                 entry.txid = entry.TxId
//                 entry.id = entry.TxId
//                 entry.address = entry.CryptoAddress
//                 entry.amount = entry.Amount
//                 entry.timestamp = new Date(entry.LastUpdated).getTime()/1000
//                 if(entry.Confirmations > 0) entry.complete = true
//                 if(!entry.complete) entry.status = "incomplete"
//                 entry.exchange = exchangeName
//                 output.push(entry)
//             }
//         }
//
//         if(withdrawals){
//             for (let i = 0; i < withdrawals.length; i++) {
//                 let entry = withdrawals[i]
//                 entry.withdrawal = true
//                 entry.timestamp = new Date(entry.Opened).getTime()/1000
//                 entry.id = entry.PaymentUuid
//                 entry.coin = entry.Currency
//                 entry.txid = entry.TxId
//                 entry.address = entry.CryptoAddress
//                 entry.amount = entry.Amount
//                 if(entry.txid) entry.complete = true
//                 if(!entry.complete) entry.status = "incomplete"
//                 entry.exchange = exchangeName
//                 output.push(entry)
//             }
//         }
//
//
//         return output
//     }catch(e){
//         console.error(tag,"error: ",e)
//         throw(e)
//     }
// }
//
// const get_deposit_history = function(account,coin){
//     const tag = exchangeName+" | get_deposit_history | "
//     const d = when.defer();
//
//     if(coin)coin = coin.toLowerCase()
//     console.log(tag,"coin: ",coin)
//
//     client = new binance(config.api['bithighlander'].binance.pub, config.api['bithighlander'].binance.pri)
//     client.getdeposithistory(coin,10000,function(err, result) {
//         if (err) {
//             return d.reject("balances|" + err)
//         }
//         if(result){
//             let withdrawals = result.result
//             const output = {}
//             output.success = true
//             output.result = withdrawals
//             d.resolve(output)
//         } else {
//             console.error(tag," ERROR: ",result)
//         }
//     })
//
//     return d.promise
// }
//
// const get_withdrawal_history = function(coin){
//     const tag = exchangeName+" | get_withdrawal_history | "
//     const d = when.defer();
//
//     if(coin)coin = coin.toLowerCase()
//
//     client.getwithdrawalhistory(coin,100,function(err, result) {
//         if (err) {
//             return d.reject("balances|" + err)
//         }
//         if(result){
//             let withdrawals = result.result
//             const output = {}
//             output.success = true
//             output.result = withdrawals
//             d.resolve(output)
//         } else {
//             console.error(tag," ERROR: ",result)
//         }
//     })
//
//     return d.promise
// }
//
// //
const withdrawal_coin = function (coin, amount, address) {
    const tag = exchangeName + ' | submit_withdrawal | '
    const d = when.defer()
    const debug = true
    coin = coin.toUpperCase()
    if (coin === 'BCH') coin = 'BCHABC'

    if (debug) console.log(tag, 'coin:', coin)
    if (debug) console.log(tag, 'amount:', amount)
    if (debug) console.log(tag, 'address:', address)

    let output = {}
    output.success = false

    client = new api.BinanceRest({
        key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
        secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
        disableBeautification: false
        /*
         * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
         * default those keys will be replaced with more descriptive, longer ones.
         */
    })
    coin = coin.toUpperCase()

    let withdraw = {
        timestamp: new Date().getTime(),
        asset: coin,
        amount,
        address,
        // recvWindow:5000,
        // name:"BTC Hot"
    }

    client.withdraw(withdraw, function (err, resp) {
        if (err) {
            console.error(tag, err, resp)
            output.error = err
            d.resolve(output)
        } else {
            console.error(tag, 'Responce: ', resp)
            if (resp.success) {
                output.success = true
                output.id = resp.id
                d.resolve(output)
            } else {
                output.error = resp.message
                d.resolve(output)
            }
        }
    })

    return d.promise
}
// //
// // const get_order_history = function(){
// //     const tag = exchangeName+" | get_order_history | "
// //     const d = when.defer();
// //     client.myTradeHistory(function(err, result) {
// //         if (err) {
// //             return d.reject("balances|" + err)
// //         }
// //         if(result){
// //             const output = {}
// //             output.success = true
// //             output.result = result
// //             d.resolve(output)
// //         } else {
// //             console.error(tag," ERROR: ",result)
// //         }
// //     })
// //     return d.promise
// // }
// //
//
// const post_bid_market = function(pair, amount){
//     const tag = exchangeName+" | post_bid_market | "
//     const d = when.defer();
//
//     //const binancePair = ["BTC","LTC"]
//     const binancePair = pair.split("_")
//     const binanceMarket = binancePair[0]+"-"+binancePair[1]
//     console.log(tag,"rate : ",rate)
//     console.log(tag,"binanceMarket : ",binanceMarket)
//
//
//     client.buymarket(binanceMarket, amount, function(error, result){
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
// const post_ask_market = function(pair, amount){
//     const tag = exchangeName+" | post_ask_market | "
//     const d = when.defer();
//     const binancePair = pair.split("_")
//     const binanceMarket = binancePair[0]+"-"+binancePair[1]
//
//     console.log(tag,"amount : ",amount)
//     console.log(tag,"binanceMarket : ",binanceMarket)
//
//     client.sellmarket(binanceMarket, amount, function(error, result) {
//         if (error) {
//             console.error(tag, " Error: ", error)
//         } else {
//             console.log(tag, " resp: ", result)
//             d.resolve(result)
//         }
//     });
//     return d.promise
// }
//

const post_bid = function (account, pair, rate, amount) {
    const tag = exchangeName + ' | post_bid | '
    const d = when.defer()

    client = new api.BinanceRest({
        key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
        secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
        disableBeautification: false
        /*
         * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
         * default those keys will be replaced with more descriptive, longer ones.
         */
    })

    /*
        Name 	Type 	Mandatory 	Description
        symbol 	STRING 	YES
        side 	ENUM 	YES
        type 	ENUM 	YES
        timeInForce 	ENUM 	NO
        quantity 	DECIMAL 	YES
        price 	DECIMAL 	NO
        newClientOrderId 	STRING 	NO 	A unique id for the order. Automatically generated if not sent.
        stopPrice 	DECIMAL 	NO 	Used with STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, and TAKE_PROFIT_LIMIT orders.
        icebergQty 	DECIMAL 	NO 	Used with LIMIT, STOP_LOSS_LIMIT, and TAKE_PROFIT_LIMIT to create an iceberg order.
        newOrderRespType 	ENUM 	NO 	Set the response JSON. ACK, RESULT, or FULL; default: RESULT.
        recvWindow 	LONG 	NO
        timestamp 	LONG 	YES
     */
    let type = 'MARKET'
    let quantity = amount
    let price = parseFloat(rate)
    let side = 'BUY'
    let symbol = pair
    let timestamp = new Date().getTime()
    let timeInForce = 'GTC'

    // quantity = quantity.toFixed(3)

    let order = { symbol, side, type, quantity, timestamp }
    console.log(tag, 'order: ', order)
    client.newOrder(order, function (error, result) {
        if (error) {
            console.error(tag, ' Error: ', error)
        } else {
            console.log(tag, ' resp: ', result)
            d.resolve(result)
        }
    })
    return d.promise
}

const post_ask = function (account, pair, rate, amount) {
    const tag = exchangeName + ' | post_ask | '
    const d = when.defer()
    let debug = true

    client = new api.BinanceRest({
        key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
        secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
        timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
        recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
        disableBeautification: false
        /*
         * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
         * default those keys will be replaced with more descriptive, longer ones.
         */
    })

    /*
        Name 	    Type 	Mandatory 	Description
        symbol 	    STRING 	YES
        side 	    ENUM 	YES
        type 	    ENUM 	YES
        timeInForce ENUM 	NO
        quantity 	DECIMAL 	YES
        price 	    DECIMAL 	NO
        newClientOrderId 	STRING 	NO 	A unique id for the order. Automatically generated if not sent.
        stopPrice 	DECIMAL 	NO 	Used with STOP_LOSS, STOP_LOSS_LIMIT, TAKE_PROFIT, and TAKE_PROFIT_LIMIT orders.
        icebergQty 	DECIMAL 	NO 	Used with LIMIT, STOP_LOSS_LIMIT, and TAKE_PROFIT_LIMIT to create an iceberg order.
        newOrderRespType 	ENUM 	NO 	Set the response JSON. ACK, RESULT, or FULL; default: RESULT.
        recvWindow 	LONG 	NO
        timestamp 	LONG 	YES
    */

    if (debug) console.log(tag, ' pair: ', pair)
    if (debug) console.log(tag, ' rate: ', rate)
    if (debug) console.log(tag, ' rate: ', typeof (rate))
    if (debug) console.log(tag, ' amount: ', amount)

    if (typeof (rate) === 'string') rate = parseFloat(rate)
    // precision
    rate = rate.toFixed(5)

    let type = 'MARKET'
    let quantity = amount
    let price = rate
    let side = 'SELL'
    let symbol = pair
    let timestamp = new Date().getTime()
    let timeInForce = 'GTC'

    quantity = quantity.toFixed(3)

    let order = { symbol, side, type, quantity, timestamp }
    console.log('order: ', order)

    let totalAmount = amount * rate
    console.log('totalAmount: ', totalAmount)

    client.newOrder(order, function (error, result) {
        if (error) {
            console.error(tag, ' Error: ', error)
            d.reject(error)
        } else {
            console.log(tag, ' resp: ', result)
            d.resolve(result)
        }
    })

    // if(totalAmount >= 0.001){
    //     client.newOrder(order, function(error, result) {
    //         if (error) {
    //             console.error(tag, " Error: ", error)
    //             d.reject(error)
    //         } else {
    //             console.log(tag, " resp: ", result)
    //             d.resolve(result)
    //         }
    //     });
    // } else {
    //     let minAmount = 0.001 * rate
    //     d.reject('Too small an order! amount: '+totalAmount+' min:'+minAmount)
    // }

    return d.promise
}

let get_balances = function (account) {
    const tag = exchangeName + ' | get_balances | '
    let debug = false
    const d = when.defer()
    // const binance = require('./../exchange-support/binance-api');
    if (debug) console.log(tag, 'account: ', account)
    if (debug) console.log(tag, 'account2: ', config.EXCHANGES_CONFIG.Credentials.binance.key)

    if (!config.EXCHANGES_CONFIG.Credentials.binance) {
        console.error('ACCOUNT NOT CONFIGURED!!! binance a:' + account)
        d.resolve([])
    } else {
        client = new api.BinanceRest({
            key: config.EXCHANGES_CONFIG.Credentials.binance.pub, // Get this from your account on binance.com
            secret: config.EXCHANGES_CONFIG.Credentials.binance.pri, // Same for this
            timeout: 15000, // Optional, defaults to 15000, is the request time out in milliseconds
            recvWindow: 10000, // Optional, defaults to 5000, increase if you're getting timestamp errors
            disableBeautification: false
            /*
             * Optional, default is false. Binance's API returns objects with lots of one letter keys.  By
             * default those keys will be replaced with more descriptive, longer ones.
             */
        })

        // client = new binance(config.EXCHANGES_CONFIG.Credentials.binance.pub, config.EXCHANGES_CONFIG.Credentials.binance.pri)
        client.account(function (err, resp) {
            // console.error(tag,err,resp)
            if (err) {
                console.error(tag, err, resp)
            } else {
                // console.log(tag,"Response: ",resp)
                const output = {}
                let entries = resp.balances
                if (entries) {
                    for (let j = 0; j < entries.length; j++) {
                        let entry = entries[j]
                        output[entry.asset] = parseFloat(entry.free)
                    }
                }

                d.resolve(output)
            }
        })
    }

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
// const initialize_binance = co.wrap(function* () {
//     const tag = " | initialize_binance | "
//     const time = Date().getTime()
//
//     // sub to binance
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

// functions
