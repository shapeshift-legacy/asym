/**
 * Created by highlander on 6/14/17.
 */

const config = require('../config')
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const views = require('./../modules/views.js')

// get backlog

// if greater then x alert
const run = async function (days) {
    const tag = ' | find_order | '
    const debug = true
    const debug1 = false
    try {
        // get backlog btc
        let backlog = await redBack.get('BTC:backlog')
        console.log(tag, 'backlog: ', backlog)
        views.displayStringToChannel('BTC Backlog: ' + backlog, 'test-reports')

        let backlog2 = await redBack.get('ETH:backlog')
        console.log(tag, 'backlog: ', backlog2)
        views.displayStringToChannel('ETH Backlog: ' + backlog2, 'test-reports')

        let backlog3 = await redBack.get('LTC:backlog')
        console.log(tag, 'backlog: ', backlog3)
        views.displayStringToChannel('LTC Backlog: ' + backlog3, 'test-reports')

        return true
    } catch (e) {
        console.error(tag, 'e:', e)
        throw 'ERROR:100 Failed to find simple! :' + e
    }
}

run()
setInterval(run, 1000 * 30)
