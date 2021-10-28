const when = require('when')
const randomstring = require('randomstring')
const request = require('request-promise')
const log = require("loggerdog-client")()
const config = require('../config')
const Redis = require('then-redis')

const redBack = require('./redis.js')

const exchangeMod = {}
exchangeMod.kraken = require('./../exchanges/kraken-client.js')
exchangeMod.bittrex = require('./../exchanges/bittrex-client.js')
exchangeMod.poloniex = require('./../exchanges/poloniex-client.js')
exchangeMod.bitfinex = require('./../exchanges/bitfinex-client.js')

// mongo
const monk = require('monk')
const db = monk(config.MONGO_URI)
const balancesDB = db.get('asynbalances')

const TAG = ' | balances | '
const QUOTE_API_URL = config.QUOTE_API_URL

let env = config.setting
let removeLoans = false
if (env == 'prod') {
    removeLoans = true
}

const expireHack = {
    btc: 40,
    maid: 40,
    usdt: 40,
    msc: 40,
    xcp: 40,
    zec: 20,
}

const exchanges = [
    'bittrex',
    'bitfinex',
    'poloniex'
]

module.exports = {
    position: function () {
        return get_balances_with_pending()
    },
    byCoin: function () {
        return balances_by_coin()
    }
}

/********************************************************
 //    Primary
 //********************************************************/
 const balances_by_coin = async function () {
     const tag = TAG + ' | balances_by_coin | '
     const debug = false
     try {
         const position = await get_balances_with_pending()
	     log.debug(tag,"position: ",typeof(position))
	     log.debug(tag,"position: ",JSON.stringify(position))
         const coinBalances = {}

         Object.keys(position).forEach(async function (account) {
             // iterate each coin
             log.debug(tag, 'account: ', account)
             Object.keys(position[account]).forEach(async function (coin) {
                 // coin = coin.toUpperCase()
                 log.debug(tag, 'coin: ', coin)
                 if (!coinBalances[coin]) coinBalances[coin] = {}
                 if (!coinBalances[coin][account]) coinBalances[coin][account] = {}
                 coinBalances[coin][account] = parseInt(position[account][coin].balance)
             })
         })
         log.debug(tag, 'coinBalances: ', coinBalances)
         return coinBalances
     } catch (e) {
         console.error(tag, 'ERROR:', e)
     }
 }

// get_balances
// get trade balances
// get exchange balances
// get balances snapshots
// find diff from tradeBalances
// pick best final
// save
// compare with 1 hour
// get trends
const get_balances_with_pending = async function () {
    const tag = TAG + ' | get_balances_with_pending | '
    const debug = false
    try {
        log.info(tag, 'checkpoint1 ')
        let report = {}

        // get balances object from trading-quote-api
        let balances = await getBalances()
        balances = formatBalances(balances)

	    log.debug(tag,"balances: ", JSON.stringify(balances))
        if (!balances) throw Error('101: balances not found!')

        let loans = {}
        loans.bitfinex = await redBack.hgetall('bitfinex:loans')
        loans.kraken = await redBack.hgetall('kraken:loans')
        loans.bittrex = await redBack.hgetall('bittrex:loans')
        loans.binance = await redBack.hgetall('binance:loans')

        if (!loans.bitfinex) loans.bitfinex = {}
        if (!loans.kraken) loans.kraken = {}
        if (!loans.bittrex) loans.bittrex = {}
        if (!loans.binance) loans.binance = {}
        log.debug(tag, 'loans: ', loans)

        let coins = await get_coins()

        // save snapshot in mongo
        let entry = {}
        entry.quid = randomstring.generate(7).toUpperCase()
        entry.time = new Date().getTime()
        entry.date = new Date()
        entry.balances = balances
        balancesDB.insert(entry)

        // for each exchange record balance changes/auto-complete from last balance
        let balancesByCoin = {}
        let time = new Date().getTime()
        for (let i = 0; i < exchanges.length; i++) {
            let exchange = exchanges[i]
            report[exchange] = {}
            // for each coin
            for (let j = 0; j < coins.length; j++) {
                let coin = coins[j]

                if (balances[exchange] && balances[exchange][coin]) {
                    redBack.hset(exchange, 'status', 'online')
                    redBack.hset(exchange, 'lastUpdated', time)

                    let balance = balances[exchange][coin]

                    // balancesByCoin
                    if (!balancesByCoin[coin]) balancesByCoin[coin] = {}
                    balancesByCoin[coin][exchange] = balance.balance

                    // get last balance
                    let lastAmount = await redBack.hget('account:' + exchange, coin)

                    balance = parseInt(balance)
                    lastAmount = parseInt(lastAmount)
                    report[exchange][coin] = { balance, lastAmount }

                    if (lastAmount > balance) {
                        // record credit
                        let credit = lastAmount + balance
                        report[exchange][coin].credit = credit
                    } else if (lastAmount < balance) {
                        // record debit
                        let debit = lastAmount - balance
                        report[exchange][coin].debit = debit
                    } else if (lastAmount == balance) {
                        //
                    }
                    // update
                    await redBack.hset('account:' + exchange, coin, balance)
                } else {
                    // push event report (exchange down)

                    // set state too offline
                    redBack.hset(exchange, 'status', 'offline')
                    redBack.hset(exchange, 'lastOff', time)

                    // get last update
                    let lastUpdate = await redBack.hget(exchange, 'lastUpdate')
                    report[exchange].state = 'offline'
                    let downtime = lastUpdate - time
                    report[exchange].downtime = downtime

                    // use last
                    // TODO thresholds on exchange down too long?
                    if (downtime > 10000000) throw Error('102: exchange down too long! can not procede!')

                    let balance = await redBack.hget('account:' + exchange, coin)
                    balance = parseInt(balance)

                    if (balances[exchange]) balances[exchange][coin] = balance
                }
            }
        }

        // TODO adjust loans
        let ethRate = await get_eth_rate()
	    log.debug(tag, 'ethRate: ', ethRate)
	    log.debug(tag, 'balancesByCoin: ', balancesByCoin)
	    log.debug(tag, 'btc balances: ', balancesByCoin.btc)

	    // subtract loans
	    if (removeLoans) {
		    // remove loans
		    Object.keys(loans).forEach(function (account) {
			    //
			    log.debug(tag, 'account: ', account)
			    // for each coin
			    Object.keys(loans[account]).forEach(function (coin) {
				    log.debug(tag, 'coin: ', coin)
				    const amountLoan = loans[account][coin]

				    let balanceWithLoan = 0
				    if (balances[account] && balances[account][coin]) balanceWithLoan = balances[account][coin].balance

				    log.debug(tag, 'amountLoan: ', amountLoan)
				    log.debug(tag, 'balanceWithLoan: ', balanceWithLoan)

				    // adjusted balance
				    const adjustedBalance = balanceWithLoan - amountLoan
				    log.debug(tag, 'adjustedBalance: ', adjustedBalance)
				    if (balances[account] && balances[account][coin]) balances[account][coin].balance = adjustedBalance
			    })
		    })
	    }

        return balances
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}


const get_eth_rate = async function () {
	let tag = TAG + ' | get_eth_rate | '
	let debug = true
	try {
		// let url = 'https://api.bitfinex.com/v1/pubticker/ethbtc'
		// let result = await get_request(url)
		// if (typeof (result) === 'string') result = JSON.parse(result)
		// log.debug(tag, 'result: ', result)
		// let output = result.last_price
		// if(!output) output = 215
		return 215
	} catch (e) {
		console.error(tag, 'e: ', e)
	}
}


const get_request = function (url) {
	const d = when.defer()
	const tag = TAG + ' | get_request | '

	request(url, function (error, response, body) {
		if (error) {
			d.reject(error)
		}

		d.resolve(body)
	})
	return d.promise
}

/**
  * Retrieve balance data from trading quote api
  * @returns {object} - balances data
  */
async function getBalances () {
    let tag = TAG+ " | getBalances | "
	let debug = false
	try {
        const options = {
            method: 'GET',
            uri: `${QUOTE_API_URL}/balances`,
            json: true,
            simple: false,
            resolveWithFullResponse: true
        }

        const response = await request(options)
        log.debug(tag,"response: ",JSON.stringify(response))
		const { statusCode, body } = response
		log.debug(tag,"statusCode: ",statusCode)
		log.debug(tag,"body: ",body)

        if (statusCode === 200) {
	        log.debug(tag," Checkpoint 200 ")
        	return body
        } else {
	        console.error(tag,`Error getting balances, response ${body}, statusCode: ${statusCode}`)
            throw new Error(`Error getting balances, response ${body}, statusCode: ${statusCode}.`)
        }
    } catch (error) {
        const errorMessage = `Balances getBalances Error: Failed to retrieve balances from trading-quote-api.`
        console.error(tag,"ERROR: ",JSON.stringify(error))
	    this.logger.error(error, errorMessage)
        throw new Error(errorMessage)
    }
}


const formatBalances = function (balances) {
	let tag = TAG + " | formatBalances | "
	let debug = false
	try{
		log.info(tag,"balances: ",JSON.stringify(balances))
		const formatted = {
			'hot':{},
			'bitfinex': {},
			'bittrex': {},
			'binance': {},
			'poloniex': {},
            'tagomi': {},
			'kraken':{}
		}

		const coins = Object.keys(balances)
		for (let coin of coins) {
			let data = balances[coin]

			coin = coin.toLowerCase()

			formatted.hot[coin] = {
				address: null,
				balance: data.internal_total,
				usdvalue: null
			}
			const exchanges = Object.keys(data.external)

			for (let exchange of exchanges) {
				const balance = data.external[exchange]

				log.debug("exchange: ",exchange)
				log.debug("coin: ",coin)
				if(coin && exchange && formatted[exchange]){

					formatted[exchange][coin] = {
						address: null,
						balance: balance.trading,
						usdvalue: null
					}
				}
			}

		}

		return formatted
	}catch(e){
		console.error(tag,"e: ",e)
	}
}

const get_coins = async function () {
    let tag = TAG + ' | get_coins | '
    try {
        // let staging have more coins
        let env = config.setting
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
