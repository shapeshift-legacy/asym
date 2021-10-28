/**
 * Created by highlander on 9/1/17.
 */
/**
 * Created by highlander on 5/30/17.
 */
const when = require('when')
const fs = require('fs')
const monk = require('monk')
const json2csv = require('json2csv')
const config = require('../config')
const db = monk(config.MONGO_URI)
const balancesH = db.get('asynbalances')
const actionsH = db.get('actions')
const reportsH = db.get('reports')
const SlackUpload = require('node-slack-upload')
const slackUp = new SlackUpload(config.SLACK_CONFIG.token)

let TAG = ' | reports | '
const exchanges = {}
exchanges.kraken = require('./../exchanges/kraken-client.js')
exchanges.bittrex = require('./../exchanges/bittrex-client.js')
// exchanges.poloniex = require('./../exchanges/poloniex-client.js')
exchanges.bitfinex = require('./../exchanges/bitfinex-client.js')

let exchangeNames = Object.keys(exchanges)
let dbs = {}
for (let i = 0; i < exchangeNames.length; i++) {
    let exchange = exchangeNames[i]
    dbs[exchange + 'Trades'] = db.get(exchange + 'Trades')
    dbs[exchange + 'Transfers'] = db.get(exchange + 'Transfers')
    dbs[exchange + 'Trades'].ensureIndex({ id: 1 }, { unique: true })
    dbs[exchange + 'Transfers'].ensureIndex({ id: 1 }, { unique: true })
    // dbs[exchange+"Trades"].createIndex({id: 1}, {unique: true})     //if mongo version > 3
    // dbs[exchange+"Transfers"].createIndex({id: 1}, {unique: true})  //if mongo version > 3
}

// coins
dbs['XMRTransfers'] = db.get('XMRTransfers')

const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

module.exports = {

    // count
    count: async function (coin) {
        let debug = true
        let tag = TAG + ' | count | '
        try {
            coin = coin.toUpperCase()

            let mongoData = await dbs[coin + 'Transfers'].count()
            if (debug) console.log(tag, 'mongoData: ', mongoData)

            return { count: mongoData }
        } catch (e) {
            console.error(console.error('e: ', e))
        }
    },

    // give me latest tx's
    latest: async function (coin, count) {
        let debug = true
        let tag = TAG + ' | transferReportQuick | '
        try {
            coin = coin.toUpperCase()
            let query = {}
            let options = { limit: count, sort: { timestamp: -1 } }

            let mongoData = await dbs[coin + 'Transfers'].find(query)
            if (debug) console.log(tag, 'mongoData: ', mongoData)

            if (mongoData.length > 0) {
                await raw_to_csv(mongoData, coin + ':txid:' + txid)
                return 'done'
            } else {
                return 'no records found~!'
            }
        } catch (e) {
            console.error(console.error('e: ', e))
        }
    },
    //

    // lookup by txid
    byTxid: async function (coin, txid) {
        let debug = true
        let tag = TAG + ' | transferReportQuick | '
        try {
            coin = coin.toUpperCase()
            let query = {}
            let options = { txid: txid }

            let mongoData = await dbs[coin + 'Transfers'].find(query)
            if (debug) console.log(tag, 'mongoData: ', mongoData)

            if (mongoData.length > 0) {
                await raw_to_csv(mongoData, coin + ':latest')
                return 'done'
            } else {
                return 'no records found~!'
            }
        } catch (e) {
            console.error(console.error('e: ', e))
        }
    },

    // lookup by address
    byAddress: async function (coin, address) {
        let debug = true
        let tag = TAG + ' | transferReportQuick | '
        try {
            coin = coin.toUpperCase()
            let query = {}
            let options = { destination: address }

            let mongoData = await dbs[coin + 'Transfers'].find(query)
            if (debug) console.log(tag, 'mongoData: ', mongoData)

            if (mongoData.length > 0) {
                await raw_to_csv(mongoData, coin + ':latest')
                return 'done'
            } else {
                return 'no records found~!'
            }
        } catch (e) {
            console.error(console.error('e: ', e))
        }
    },
}

//

let raw_to_csv = async function (data, title) {
    try {
        let fields = Object.keys(data[0])

        const result = json2csv({ data: data, fields: fields })

        // write to file
        const filename = title + '.csv'
        await write_file(filename, result)

        // upload to slack
        await upload_to_slack(filename, config.SLACK_CONFIG.channel)

        return { success: true }
    } catch (e) {

    }
}

const write_file = function (filename, data) {
    const d = when.defer()

    fs.writeFile(filename, data, function (err) {
        if (err) throw err

        d.resolve(true)
    })
    return d.promise
}

const upload_to_slack = function (filename, channel) {
    const d = when.defer()

    slackUp.uploadFile({
        file: fs.createReadStream(filename),
        filetype: 'csv',
        title: filename,
        initialComment: filename,
        channels: channel
    }, function (err, data) {
        if (err) {
            console.error(err)
            d.resolve(false)
        } else {
            console.log('Uploaded file details: ', data)
            d.resolve(true)
        }
    })

    return d.promise
}

function arr_diff (a1, a2) {
    let a = [], diff = []

    for (var i = 0; i < a1.length; i++) {
        a[a1[i]] = true
    }

    for (var i = 0; i < a2.length; i++) {
        if (a[a2[i]]) {
            delete a[a2[i]]
        } else {
            a[a2[i]] = true
        }
    }

    for (let k in a) {
        diff.push(k)
    }

    return diff
};
