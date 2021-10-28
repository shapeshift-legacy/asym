const request = require('request')
const when = require('when')
const TAG = ' | balancer | '
const debug = false
const yubikey = require('./yubikey.js')
const randomstring = require('randomstring')
const Redis = require('then-redis')
const pending = require('./pending.js')
const views = require('./views.js')
//const commonLibrary = require('common-library')
const uuid = require('uuid')
const anycoinHelpers = require('./anycoin-helpers')

// Anycoin Client Setup
const config = require('../config')
const anycoinConfigs = config.ANYCOIN_CONFIG


// get exchanges
const exchanges = {}
exchanges.kraken = require('./../exchanges/kraken-client.js')
exchanges.bittrex = require('./../exchanges/bittrex-client.js')
exchanges.bittrex = require('bittrex-withdraw-ccxt')
// exchanges.poloniex = require('./../exchanges/poloniex-client.js')
exchanges.bitfinex = require('./../exchanges/bitfinex-client.js')
exchanges.binance = require('./../exchanges/binance-client.js')
exchanges.tagomi = require('./../exchanges/tagomi-client.js')
exchanges.tagomi.init()
exchanges.bittrex.init(config.EXCHANGES_CONFIG.Credentials.bittrex.pub,config.EXCHANGES_CONFIG.Credentials.bittrex.pri)

const redBack = require('./redis.js')
const servers = config.COIN_SERVERS
const nerf = false


let whitelist = require('../shapeshift-whitelists-tracked/addressesProd.js')

/*
if (config.setting === 'prod') {
    let whitelist = require('../shapeshift-whitelists/addressesProd.js')
} else if (config.setting === 'dev') {
    let whitelist = require('../shapeshift-whitelists/addressesDev.js')
} else if (config.setting === 'staging') {
    let whitelist = require('../shapeshift-whitelists/addressesStaging.js')
} else if (config.setting === 'personal') {
    let whitelist = require('../shapeshift-whitelists/addressesPersonal.js')
} else {
    console.error(' NOT CONFIGURED!! MISSING WHITELIST!!!')
}
*/

module.exports = {
    // is in blacklist
    balance: function (coin, amount, source, destination, user) {
        return perform_balance_action_auto(coin, amount, source, destination, user)
    },
}

const perform_balance_action_auto = async function (coin, amount, source, destination, user) {
    const tag = TAG + ' | perform_balance_action_auto | '
    const debug = true
    try {
        if (source === 'btce') return 'Cant withdrawal from ' + source + ' NERFED!'
        if (debug) console.log(tag, 'params: ', { coin, amount, source, destination })
	    // console.log(tag,"whitelist: ",JSON.stringify(whitelist))
	    // console.log(tag,"whitelist: ",typeof(whitelist))
	    // console.log(tag,"whitelist: ",whitelist['TUSD'])
	    // console.log(tag,"whitelist: ",whitelist['TUSD'].withdraw)

        if (exchanges[source]) {
            await exchanges.tagomi.init()
	        if (debug) console.log(tag,"Checkpoint FROM exchange! ")
	        //console.log(tag,"whitelist: ",whitelist)


            let client = destination
            if (destination === 'hot') client = 'withdraw'
            //if (!whitelist[coin.toUpperCase()]) console.error(tag, 'whitelist: ', whitelist)
            if (!whitelist[coin.toUpperCase()]) throw Error('Address missing in whitelist! coin: ' + coin)
            const address = whitelist[coin.toUpperCase()][client].address
            if (debug) console.log(tag, 'address: ', address)

            //NOTE: dust hack request. (@danielle)
            //Nonce added PER coin, PER exchange
            let nextNonce = await redBack.hincrby(address+":nonceSend",coin.toUpperCase,1)
            //stringify number
            nextNonce = nextNonce.toString()
            nextNonce = ".1"+nextNonce

            //HACK if string return string, if number return number
            //TODO typeing
            if(typeof(amount) === 'number'){
                amount = amount.toString() + nextNonce
                amount = parseFloat(amount).toPrecision(6) // 6 because of bitfinex and others dont support to satoshi
            }else{
                amount = amount + nextNonce
            }
	    if(source === 'bittrex'){
	    	coin = coin.toUpperCase()
	    }
            if (debug) console.log(tag, 'withdrawal amount: ', amount)
            let result = await exchanges[source].withdrawal(coin, amount, address)
            if (debug) console.log(tag, 'withdrawal result: ', result)
            if (!result.success) {
                // push error to alerts
                let channel
                if (config.setting === 'prod') {
                    channel = 'alerts'
                } else {
                    channel = 'alerts-staging'
                }
                let path = source + '_' + destination
                views.displayStringToChannel(':' + coin + ': ' + coin + ' ' + path + ' is BROKE! error: ' + result.error, channel)
                throw result.error
            }

            let id = null
            if (source === 'poloniex') {
                // makeup a txid because polo sucks
                id = new Date().getTime()
                id = id / 1000000
                id = parseInt(id)
                id = coin.toUpperCase() + ':' + id

                // trim to timeframe
            } else if (source === 'bitfinex') {
                // bitfinex withdrawal_id:
                if (typeof (result) === 'string') result = JSON.parse(result)
                id = result.id
            } else if (source === 'bittrex') {
                // bitfinex withdrawal_id:
                // if(typeof(result) === "string") result = JSON.parse(result)
                console.log(tag, 'result: ', result)
                // console.log(tag,"result: ",typeof(result))
                // console.log(tag,"result: ",result.result)
                // console.log(tag,"result: ",result.result.uuid)
                id = result.id
            } else if (source === 'kraken') {
                id = result.id
            } else {
                console.error(tag, ' Unhandled source send!!!! ', source)
            }

            //
            let txInfo = {}
            txInfo.id = id
            txInfo.txid = null
            txInfo.exchange = source
            txInfo.source = source
            txInfo.destination = destination
            txInfo.instantDebit = true
            txInfo.instantCredit = false
            txInfo.coin = coin
            txInfo.blockchainTxid = null
            txInfo.amount = amount
            txInfo.settled = false
            txInfo.user = user
            // pending profile
            // withdraw from exchange
            // may or may not debit instantly???
            // will NOT have a txid instantly
            // will not credit instantly
            // if(txid && typeof(txid) == "string" && txid != "undefined" && txid != "[object Object]" && result && result.indexOf("error") === -1 && !result.error){
            //
            // } else {
            //     //
            //     console.error(tag,destination," Invalid txid!!! can not save pending!",response)
            // }
            if (user === 'asym' || config.setting != 'prod') pending.create(txInfo)

            const output = {
                succcess: true,
                msg: result,
            }
            return result
        } else {
            if (debug) console.log(tag, 'whitelist: ', whitelist)
            const address = whitelist[coin.toUpperCase()][destination].address
            if (!address) console.error('100: no address found for destination: ' + destination)
            if (debug) console.log(tag, 'address: ', address)

            let param1 = null
            if (whitelist[coin.toUpperCase()][destination].param) param1 = whitelist[coin.toUpperCase()][destination].param
            let body


            //NOTE: dust hack request. (@danielle)
            //Nonce added PER coin, PER exchange
            let nextNonce = await redBack.hincrby(address+":nonceSend",coin.toUpperCase,1)
            //stringify number
            nextNonce = nextNonce.toString()
            nextNonce = ".1"+nextNonce

            //HACK if string return string, if number return number
            //TODO typeing
            if(typeof(amount) === 'number'){
                amount = amount.toString() + nextNonce
                amount = parseFloat(amount).toPrecision(6) // 6 because of bitfinex and others dont support to satoshi
            }else{
                amount = amount + nextNonce
            }


            if (!param1) body = { coin, address, amount }
            if (param1) body = { coin, address, amount, param1 }
            if (!servers[coin.toLowerCase()] && !anycoinConfigs[coin.toLowerCase()]) throw Error('100 No server found for: ' + coin)

            let url = servers[coin.toLowerCase()] + '/sendToAddress'

            if (debug) console.log(tag, 'withdrawal amount: ', amount)
            // send directly to anycoin if this is an anycoin configured coin
            let anycoinSend = false
            if (anycoinConfigs[coin.toLowerCase()]) {
                anycoinSend = true
                let asymID = uuid.v4()
                let externalIndex = anycoinHelpers.getAsymID(asymID)
                let lowerCoin = coin.toLowerCase()
                let destinationAmounts =  {}
                let destinationPaths = {}
                destinationAmounts[address] = amount
                destinationPaths[address] = 'ASYM'
                let data = null
                let auth = null
                body = {
                    coin: lowerCoin,
                    destinationAmounts,
                    destinationPaths,
                    data,
                    externalIndex,
                    auth,
                    param1
                }
                url = `${servers.anycoin}/coins/${coin.toLowerCase()}/settlements`
            }

            if (debug) console.log(tag, 'body: ', body)
            let response = await post_request(url, body)
            if (debug) console.log(tag, 'client result: ', response)
            if (debug) console.log(tag, 'response: ', response)
            if (debug) console.log(tag, 'response: ', typeof (response))
            let txid
            let client = 'middle_earth'
            if (anycoinSend) {
                txid = 'anycoin_pending'
                client = 'anycoin'
            } else if (typeof (response === 'string')) {
                try {
                    response = JSON.parse(response)
                    if(!response.txid) throw Error(" Not a json object")
                    txid = response.txid
                } catch (e) {
                    console.error(tag, 'error: ', e)
                    txid = response
                }
            } else if (response.txid) {
                txid = response.txid
            } else {
                txid = response.toString()
            }

            // if txid is a string and length > x
            // ![object object]

            // add to pending
            // profile, send from hot is instant debit
            // credit will sit pending till confirmed
            if (debug) console.log('1 **************** source: ', source)

            let txInfo = {}
            txInfo.txid = txid
            txInfo.id = null
            txInfo.source = source
            txInfo.exchange = destination
            txInfo.destination = destination
            txInfo.instantDebit = true
            txInfo.instantCredit = false
            txInfo.coin = coin
            txInfo.blockchainTxid = txid
            txInfo.amount = amount
            txInfo.settled = false
            txInfo.user = user
            txInfo.client = client
            // pending profile
            // withdraw from exchange
            // may or may not debit instantly???
            // will NOT have a txid instantly
            // will not credit instantly
            // if(txid && typeof(txid) == "string" && txid != "undefined" && txid != "[object Object]"){
            //     await pending.create(txid,txInfo)
            // } else {
            //     //
            //     console.error(tag,destination," Invalid txid!!! can not save pending!",response)
            // }
            if (debug) console.log('**************** txInfo: ', txInfo)
            //if (user === 'asym' || config.setting != 'prod')pending.create(txInfo)

            const output = {
                user: user + ' authenticated! ',
                succcess: true,
                txid,
            }
            return output
        }
    } catch (e) {
        console.error(tag, 'ERROR:', e)
        let output = {
            succcess: false,
            msg: e,
        }
        return output
    }
}

const post_request = function (url, body) {
    const d = when.defer()
    const tag = TAG + ' | post_request | '
    const options = {
        method: 'POST',
        url: url,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        form: body
    }
    if (debug) console.log(tag, 'options: ', options)
    request(options, function (error, response, body) {
        if (error) {
            d.reject(error)
        }

        console.log(tag, 'body: ', body)

        d.resolve(body)
    })
    return d.promise
}
