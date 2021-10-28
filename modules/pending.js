/**
 * Created by highlander on 5/10/17.
 */
const Redis = require('then-redis')
const config = require('../config')

// ME REST api
// let me = require("./uwallet.js")
let coins = require('./coins.js')
let views = require('./views.js')
const monk = require('monk')

console.log()
const db = monk(config.MONGO_URI)

// get exchanges
const exchanges = {}
exchanges.kraken = require('./../exchanges/kraken-client.js')
exchanges.bittrex = require('./../exchanges/bittrex-client.js')
// exchanges.poloniex = require('./../exchanges/poloniex-client.js')
exchanges.bitfinex = require('./../exchanges/bitfinex-client.js')

let exchangeNames = Object.keys(exchanges)
let dbs = {}
for (let i = 0; i < exchangeNames.length; i++) {
    let exchange = exchangeNames[i]
    // dbs[exchange+"Trades"] = db.get(exchange+"Trades");
    dbs[exchange + 'Transfers'] = db.get(exchange + 'Transfers')
    // dbs[exchange+"Trades"].ensureIndex({id: 1}, {unique: true})
    if (exchange === 'poloniex') {
        dbs[exchange + 'Transfers'].ensureIndex({ withdralnumber: 1 }, { unique: true })
    } else {
        dbs[exchange + 'Transfers'].ensureIndex({ id: 1 }, { unique: true })
    }
    // dbs[exchange+"Trades"].createIndex({id: 1}, {unique: true})     //if mongo version > 3
    // dbs[exchange+"Transfers"].createIndex({id: 1}, {unique: true})  //if mongo version > 3
}

const redBack = require('./redis.js')

let TAG = ' | pending | '
module.exports = {
    // read all pending
    all: function () {
        return get_all_pending()
    },
    analyize: function () {
        return analyize_all_pending()
    },
    byCoin: function (coin) {
        return get_pending_by_coin(coin)
    },
    // create pending
    create: function (txInfo) {
        return create_pending_tx(txInfo)
    },
    // delete pending
    clear: function () {
        return clear_completed_pending()
    },
}

/*************************************
 //primary
 //*************************************/
const analyze_pending = async function () {
    const tag = TAG + ' | analyze_pending | '
    const debug = false
    try {
        // get all pending
        let allPending = await get_all_pending()
        if (debug) console.log(tag, 'allPending: ', allPending)

        // calculate age
        for (let i = 0; i < allPending.length; i++) {
            let pendingInfo = allPending[i]
            if (pendingInfo.age > 90) {
                views.displayJsonToChannel(pendingInfo, 'Overdue pending!', 'alerts')
            }
        }

        return irregularities
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const create_pending_tx = async function (txInfo) {
    const tag = TAG + ' | create_pending_tx | '
    const debug = false
    try {
        if (debug) console.log(tag, 'Checkpoint1')
        if (debug) console.log(tag, 'txid: ', txid)
        if (debug) console.log(tag, 'txInfo: ', txInfo)

        if (!txInfo) throw Error('100: invalid pending creation!')

        // TODO HACK!!! FIXME
        // if(txInfo.source.length > 20){
        //     //sometimes we are showing an address as source, remove and replace with hot
        //     console.error("INVALID TXINFO!!!!!!!!!!!!", txInfo)
        //     txInfo.source = "hot"
        // }

        // get time
        let time = new Date().getTime()
        txInfo.created = time

        let result1
        let result2
        if (txInfo.id) {
            // sadd pending
            result1 = await redBack.sadd('pendingTx', txInfo.id)

            // create hash
            result2 = await redBack.hmset(txInfo.id, txInfo)
        }

        if (txInfo.txid) {
            // sadd pending
            result1 = await redBack.sadd('pendingTx', txInfo.txid)

            // create hash
            result2 = await redBack.hmset(txInfo.txid, txInfo)
        }

        if (result1 && result2) {
            return true
        } else {
            console.error(tag, ' Failed to save in redis!!')
            return false
        }
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const get_all_pending = async function () {
    const tag = TAG + ' | get_all_pending | '
    const debug = false
    try {
        // get all pending
        let pendingIds = await redBack.smembers('pendingTx')
        if (debug) console.log(tag, 'pendingIds: ', pendingIds)

        // lookup pending
        let pendings = []
        for (let i = 0; i < pendingIds.length; i++) {
            let pending = await redBack.hgetall(pendingIds[i])
            pendings.push(pending)
        }

        return pendings
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const get_pending_by_coin = async function (coin) {
    const tag = TAG + ' | get_pending_by_coin | '
    const debug = false
    try {
        coin = coin.toLowerCase()
        // get all pending
        let pendingIds = await redBack.smembers('pendingTx')
        if (debug) console.log(tag, 'pendingIds: ', pendingIds)

        // lookup pending
        let pendings = []
        for (let i = 0; i < pendingIds.length; i++) {
            let pending = await redBack.hgetall(pendingIds[i])
            if (debug) console.log(tag, 'pending: ', pending)
            if (pending.coin === coin) {
                pendings.push(pending)
            }
        }

        return pendings
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const remove_pending = async function (txid) {
    const tag = TAG + ' | remove_pending | '
    const debug = false
    try {
        return redBack.srem('pendingTx', txid)
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

function extend (target) {
    let sources = [].slice.call(arguments, 1)
    sources.forEach(function (source) {
        for (let prop in source) {
            target[prop] = source[prop]
        }
    })
    return target
}

const clear_completed_pending = async function () {
    const tag = TAG + ' | clear_completed_pending | '
    let debug = true
    let debug1 = false
    let blockchainRedundancy = true
    try {
        let output = {}
        output.closed = 0
        output.unknown = 0
        output.updated = 0
        output.found = 0
        output.total = 0

        // get all pending
        let pending = await get_all_pending()
        if (debug) console.log(tag, 'pending: ', pending)

        for (let i = 0; i < pending.length; i++) {
            // lookup in mongo
            let entry = pending[i]
            let info = await dbs[entry.exchange + 'Transfers'].find({ $or: [{ id: entry.id }, { txid: entry.txid }, { idHACK: entry.id }] })

            if (debug) console.log(tag, 'info: ', info)

            // update
            if (info.length === 0) {
                output.unknown = output.unknown + 1
            } else {
                if (info.length > 1) throw Error('100: Multiple entries for orderId!!')
                let data = info[0]
                // update txid
                if (data.txid) redBack.hset(entry.id, 'txid', data.txid)
                if (data.complete) redBack.hset(entry.id, 'complete', 'true')
                if (data.amount) redBack.hset(entry.id, 'amountActual', data.amount)
                if (data.timestamp) redBack.hset(entry.id, 'timestamp', data.timestamp)

                if (data.complete) {
                    // remove from pending!!
                    // if complete remove
                    let success = await redBack.srem('pendingTx', entry.id)
                    if (!success) success = await redBack.srem('pendingTx', entry.txid)
                    views.displayString('COMPLETED! removeing orderId: ' + entry.id + ' txid: ' + data.txid + ' s:' + success)
                    output.closed = output.closed + 1
                }
            }

            // if older then x
            let time = new Date().getTime()
            let age = parseInt((time - entry.created) / 1000 / 60)
            if (age > 90) {
                console.log(tag, 'ALERT!! stuck pending! older then 90min. exchange:' + entry.exchange)
                // views.displayJsonToChannel(entry," ALERT!! stuck pending! older then 90min. exchange:"+entry.exchange,"alerts")
            }
        }

        // alert if older then x

        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

// legacy
// const clear_completed_pending = async function() {
//     const tag = TAG+" | clear_completed_pending | "
//     let debug = false
//     let debug1 = false
//     let blockchainRedundancy = true
//     try {
//         let output = {}
//         output.closed = 0
//         output.updated = 0
//         output.found = 0
//         output.total = 0
//
//         //pendings
//         let pendingIds = await redBack.smembers("pendingTx")
//         if(debug) console.log(tag,"pendingIds: ",pendingIds)
//
//         let pendingTxs = await get_all_pending()
//         if(debug) console.log(tag,"pendingTxs: ",pendingTxs)
//
//         let lookupResults
//         if(blockchainRedundancy) lookupResults = await update_blockchain_info(pendingTxs)
//
//         //for each exchange
//         let exchangeNames = await redBack.smembers("pending:exchanges")
//         //let exchangeNames = Object.keys(exchanges)
//         //output.exchanges = exchangeNames
//
//         //let exchangeNames = ["bitfinex","bittrex","poloniex"]
//         //let exchangeNames = ["poloniex"]
//
//         let transfers = []
//         for (let i = 0; i < exchangeNames.length; i++) {
//             let exchange = exchangeNames[i]
//             if(debug) console.log(tag,"exchange: ",exchange)
//
//             //get transfer history
//             let noramlizedTransferHistory = await exchanges[exchange].transferHistory()
//             if(debug) console.log(tag,"noramlizedTransferHistory: ",noramlizedTransferHistory)
//
//             //output[exchange+"Count"] = noramlizedTransferHistory.length
//
//             //magic guessing on withdrawal txid's
//             //noramlizedTransferHistory = await perform_magic_withdrawal_guessing(noramlizedTransferHistory)
//
//             let indexs = build_index(noramlizedTransferHistory)
//             if(debug) console.log(tag,"indexs: ",indexs)
//
//             let txids = indexs.txids
//             let txidIndex = indexs.txidIndex
//
//             let ids = indexs.ids
//             let idIndex = indexs.idIndex
//
//             if(debug) console.log(tag,"ids: ",ids)
//             if(debug) console.log(tag,"txids: ",txids)
//             //const output = {}
//
//             //iterate over all pending
//             for (let i = 0; i < pendingTxs.length; i++) {
//                 let txid = pendingTxs[i].txid
//                 let id = pendingTxs[i].id
//                 if(debug) console.log(tag,"txid LOOKUP: ",txid)
//                 if(debug) console.log(tag,"id LOOKUP: ",id)
//                 if(debug) console.log(tag,"id LOOKUP: ",typeof(id))
//                 if(debug) console.log(tag,"ids type: ",typeof(ids[0]))
//                 if(debug) console.log(tag,"txid LOOKUP POSITION: ",txids.indexOf(txid))
//                 if(debug) console.log(tag,"id LOOKUP POSITION: ",ids.indexOf(id))
//
//                 //match on txid
//                 if(txids.indexOf(txid) >= 0){
//
//                     output.found = output.found + 1
//
//                     //output.success = true
//                     //output.txid = txid
//                     // const position = results[txidIndex[txid]]
//                     // output.position = position
//                     //display the entry
//                     views.smartDisplay(noramlizedTransferHistory[txidIndex[txid]],"Entry found!")
//
//                     let transfer = noramlizedTransferHistory[txidIndex[txid]]
//                     if(debug) console.log(tag,"**** hit: ",transfer)
//
//                     //update status
//
//
//                     //update status
//                     if(transfer.complete){
//                         views.displayString("COMPLETED! removeing txid: "+txid)
//                         //if complete remove
//                         let success = await redBack.srem("pendingTx",txid)
//                         output.closed = output.closed + 1
//                     }
//                 } else {
//                     //output.success = false
//                 }
//
//                 //match on ID
//                 if(ids.indexOf(id) >= 0){
//                     output.found = output.found + 1
//
//                     // output.success = true
//                     // output.id = id
//                     // const position = results[txidIndex[txid]]
//                     // output.position = position
//                     //display the entry
//                     views.smartDisplay(noramlizedTransferHistory[idIndex[id]],"Entry found!")
//
//                     let transfer = noramlizedTransferHistory[idIndex[id]]
//                     if(debug) console.log(tag,"**** hit: ",transfer)
//                     //update status
//                     if(transfer.complete){
//                         views.displayString("COMPLETED! removeing txid: "+id)
//                         //if complete remove
//                         let success = await redBack.srem("pendingTx",id)
//                         output.closed = output.closed + 1
//                     }
//
//                 } else {
//                     //output.success = false
//                 }
//             }
//
//
//         }
//
//         return output
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }

// legacy
// const perform_magic_withdrawal_guessing = async function(history) {
//     const tag = TAG+" | runtime | "
//     const debug = false
//     try {
//         if(debug) console.log(tag,"hisory:", history)
//         //get withdrawals
//
//         //is there a blockchain txid?
//             //if not, assume by coin it is an open pending
//             //assign by actual ID
//
//         //if txid found in completed
//             //not related to current pending
//
//         //if 1 open in same coin assigned and close
//
//         //CLOSE ALL OTHERS AND MOVE TO COMPLETED!
//
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }

const runtime = async function (intervial) {
    const tag = TAG + ' | runtime | '
    const debug = false
    try {
        if (intervial) intervial = parseInt(intervial)
        if (!intervial) intervial = 60 // seconds

        clear_completed_pending()
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

/*************************************
 //lib
 //*************************************/

const build_index = function (noramlizedTransferHistory) {
    let txids = []
    let txidIndex = {}
    for (let i = 0; i < noramlizedTransferHistory.length; i++) {
        let result = noramlizedTransferHistory[i]
        if (result.txid) {
            txids.push(result.txid)
            txidIndex[result.txid] = i
        }
    }

    // get ids from exchange
    let ids = []
    let idIndex = {}
    for (let i = 0; i < noramlizedTransferHistory.length; i++) {
        let result = noramlizedTransferHistory[i]
        if (result && result.id) {
            result.id = result.id.toString()
            ids.push(result.id)
            idIndex[result.id] = i
        }
    }

    let output = {}
    output.txids = txids
    output.txidIndex = txidIndex
    output.ids = ids
    output.idIndex = idIndex

    return output
}

const update_blockchain_info = async function (pendingTxs) {
    const tag = TAG + ' | runtime | '
    const debug = false
    try {
        for (let i = 0; i < pendingTxs.length; i++) {
            let pendingTx = pendingTxs[i]
            if (!pendingTx.txid) status = '103: Net Yet on coin'
            if (pendingTx.txid) {
                // let local status
                if (debug) console.log(tag, 'coin: ', pendingTx.coin)
                if (debug) console.log(tag, 'txid: ', pendingTx.txid)
                let blockchainInfo = await coins.getTransaction(pendingTx.txid, pendingTx.coin)
                if (debug) console.log(tag, 'blockchainInfo: ', blockchainInfo)
                if (blockchainInfo) {
                    views.smart(blockchainInfo)
                    // TODO this was breaking shiiiittt!!! do fields by hand foo!!
                    // Object.keys(blockchainInfo).forEach(function(param) {
                    //    redBack.hset(pendingTx.txid,param,blockchainInfo[param])
                    // })
                }
            }
        }
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

// const audit_withdrawal = async function(transfer,pending) {
//     const tag = TAG+" | audit_deposit | "
//     const debug = false
//     try {
//         if(!transfer.exchange || !transfer.coin) throw Error("104: unable to audit withdraw! not normalized!!",transfer)
//
//         //normalize
//
//         /*
//             Bittrex
//
//          { PaymentUuid: 'f735fa05-4719-427a-a08c-ff3f454d6b7e',
//          Currency: 'BTC',
//          Amount: 14,
//          Address: '1FeNwwT6zZLNney13xbiibpxPhGsGMVAEn',
//          Opened: '2017-02-21T21:12:57.463',
//          Authorized: true,
//          PendingPayment: false,
//          TxCost: 0.0002,
//          TxId: '30a81e75dc92645c8beea7b702adf572b241c96fdeaaee8c02d059afaf0f54de',
//          Canceled: false,
//          InvalidAddress: false },
//
//             kraken
//
//          { method: 'Bitcoin',
//          aclass: 'currency',
//          asset: 'XXBT',
//          refid: 'AGBOOT2-GF4XH3-BGQBZ6',
//          txid: '9b161e1d2e93ff2f11f0f87c4b16db8c817025d726dd0d3d3b2c5464d17aa5b2',
//          info: '1NSc6zAdG2NGbjPLQwAjAuqjHSoq5KECT7',
//          amount: '14.99950000',
//          fee: '0.00050000',
//          time: 1494363350,
//          status: 'Success' },
//
//          */
//
//         //
//         let localTxInfo
//         let localActionInfo
//         let output = {}
//         if(transfer.txid) localTxInfo = await redBack.hgetall(transfer.txid)
//         if(transfer.id) localActionInfo = await redBack.hgetall(transfer.txid)
//
//         //
//         if(!transfer.txid) throw Error("Invalid entry! not normalized",transfer)
//
//         //
//         if(!localTxInfo && transfer.txid){
//             output.update = true
//         }
//         redBack.hmset(transfer.txid,transfer)
//         if(!localActionInfo && transfer.id){
//             output.update = true
//         }
//         redBack.hmset(transfer.id,transfer)
//
//         // if ID OR txid is in pending
//         if(pending.indexOf(transfer.txid) >= 0){
//             //check + clear
//             if(transfer.Confirmations > 0) transfer.complete = true
//
//             if(transfer.complete){
//
//                 output.close = true
//                 //remnove from pending
//                 let success = await redBack.srem("pendingTx",transfer.txid)
//                 if(debug) console.log(tag,"success: ",success)
//             }
//         } else {
//             //TODO state incomplete measure time pending
//             redBack.hset(transfer.txid,"status","incomplete")
//         }
//
//
//         return output
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }
//
// const audit_deposit = async function(transfer,pending) {
//     const tag = TAG+" | audit_deposit | "
//     const debug = false
//     const debug1 = false
//     try {
//         if(!transfer.exchange || !transfer.coin ) {
//             console.error(tag,"invalid entry: ",transfer)
//             throw Error("100: unable to audit deposit! missing params!",transfer)
//         }
//
//         //normalize
//         /*
//             bittrex
//          { PaymentUuid: 'e89a9b4a-39b5-4a90-a952-6e7f69bdd856',
//          Currency: 'BTC',
//          Amount: 1,
//          Address: '1FeNwwT6zZLNney13xbiibpxPhGsGMVAEn',
//          Opened: '2017-02-22T20:38:47.65',
//          Authorized: true,
//          PendingPayment: false,
//          TxCost: 0.0002,
//          TxId: 'e5973e6c66cab71bb7a11fd9289b6fb5b9d347de9c7559f8686cbf6e4b09d844',
//          Canceled: false,
//          InvalidAddress: false },
//
//             kraken
//
//          { method: 'Bitcoin',
//          aclass: 'currency',
//          asset: 'XXBT',
//          refid: 'QGBSJI6-DSFDX3-67CI3N',
//          txid: '51d6e53c2e3816340479ae7a611ad982dc0f3cba0ff9b3a247aee8937a10a360',
//          info: '3N1KmfpPY3Yu2GS9vRw3aB97j6TQZptWXV',
//          amount: '17.00000000',
//          fee: '0.0000000000',
//          time: 1494596016,
//          status: 'Success' },
//
//             bitfinex
//
//
//
//             polo
//
//          */
//
//         let localTxInfo
//         let localActionInfo
//         let output = {}
//
//         /*
//         if(transfer.txid) localTxInfo = await redBack.hgetall(transfer.txid)
//         if(transfer.id) localActionInfo = await redBack.hgetall(transfer.id)
//         */
//         //TODO update entry
//
//
//         //
//         if(!transfer.txid) {
//             console.error(tag,"invalid entry: ", transfer)
//             throw Error("Invalid entry! not normalized",transfer)
//         }
//
//         /*
//         if(!localTxInfo && transfer.txid){
//             output.update = true
//         }
//         if(transfer.txid)redBack.hmset(transfer.txid,transfer)
//         if(!localActionInfo && transfer.id){
//             output.update = true
//         }
//         if(transfer.id) redBack.hmset(transfer.id,transfer)
//         */
//
//
//         if(debug1) console.log(tag,"pending: ",pending)
//         if(debug1) console.log(tag,"txid: ",transfer.txid)
//         if(transfer.complete){
//             output.close = true
//
//             //remove from pending
//             let success = await redBack.srem("pendingTx",transfer.txid)
//             if(debug) console.log(tag,"success: ",success)
//         } else {
//             if(debug) console.log(tag," *** still pending: ",transfer)
//         }
//
//         return output
//     }catch(e){
//         console.error(tag,"ERROR:",e)
//     }
// }

const lookup_exchange_withdrawal = async function (tx) {
    const tag = TAG + ' | clear_completed_pending | '
    const debug = false
    try {
        let exchange = tx.source
        let coin = tx.coin
        //
        let history = await exchanges[exchange].withdrawalHistory(coin)
        if (debug) console.log(tag, 'history', history)

        // audit all history
        for (let i = 0; i < history.length; i++) {
            let entry = history[i]

            let localInfo
            if (entry.type === 'DEPOSIT') {
                // if deposit lookup by blockchain txid
                localInfo = await redBack.hgetall(entry.txid)
            } else if (entry.type === 'WITHDRAWAL') {
                localInfo = await redBack.hgetall(entry.id)
            }
            if (!localInfo) {
                // create pending
                entry.exchange = exchange
                entry.coin = coin
                create_pending_from_exchange_history(entry)
            } else if (localInfo) {
                // update local
                if (!localInfo.txid) {
                    // update txid
                    redBack.hset(tx.txid, 'blockchainTxid', entry.txid)
                }

                if (entry.status === 'COMPLETED') {
                    // remove from pending
                    await redBack.srem('pendingTx', entry.txid)
                    await redBack.srem('pendingTx', entry.id)

                    // update
                    if (entry.type === 'DEPOSIT') {
                        await redBack.hset(entry.txid, 'complete', true)
                    } else if (entry.type === 'WITHDRAWAL') {
                        await redBack.hset(entry.id, 'complete', true)
                    }
                }
            }
        }
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const create_pending_from_exchange_history = async function (tx) {
    const tag = TAG + ' | clear_completed_pending | '
    const debug = false
    try {
        let txInfo = {}
        txInfo.amount = tx.amount
        txInfo.coin = tx.coin

        if (tx.type === 'DEPOSIT') {
            txInfo.txid = tx.txid
            txInfo.debitSource = 'hot'
            txInfo.creditSource = tx.exchange
            txInfo.instantDebit = true
            txInfo.instantCredit = false
            txInfo.blockchainTxid = txid
        } else if (tx.type === 'WITHDRAWAL') {
            txInfo.txid = tx.txid
            txInfo.debitSource = tx.exchange
            txInfo.creditSource = hot
            txInfo.instantDebit = true
            txInfo.instantCredit = false
            txInfo.blockchainTxid = tx.txid
        }

        if (tx.status === 'COMPLETED') {
            txinfo.complete = true
        }

        pending.create(txInfo.txid, txInfo)
        return true
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
