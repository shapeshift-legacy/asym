/**
 * Created by highlander on 6/6/17.
 */
let Redis = require('then-redis')
const config = require('../config')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

redBack.hset('rules:percentage:btc', 'hot', 17)
redBack.hset('rules:percentage:btc', 'poloniex', 31)
redBack.hset('rules:percentage:btc', 'bitfinex', 34)
redBack.hset('rules:percentage:btc', 'kraken', 4)
redBack.hset('rules:percentage:btc', 'bittrex', 12)
redBack.hset('rules:percentage:btc', 'btce', 1)
