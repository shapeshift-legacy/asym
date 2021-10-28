/**
 * Created by highlander on 6/2/17.
 */
/**
 * Created by highlander on 5/30/17.
 */

const config = require('../config')
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const pending = require('./../modules/pending.js')
const views = require('./../modules/views.js')

module.exports = {
    // get pending
    runPending: async function () {
        let run = function () {
            pending.clear()
        }
        run()
        setInterval(run, 1000 * 30)
        return true
    },
    pendingCount: async function () {
        let pendingTxs = await pending.all()
        let report = {}
        report.total = await redBack.scard('pendingTx')
        // sort  by exchange
        for (let i = 0; i < pendingTxs.length; i++) {
            let exchange = pendingTxs[i].exchange
            if (!report[exchange]) report[exchange] = 0
            report[exchange] = report[exchange] + 1
        }

        return report
    },
    pending: async function (coin) {
        let report = {}
        let pendings
        if (!coin) pendings = await pending.all()
        if (coin) pendings = await pending.byCoin(coin)
        let time = new Date().getTime()

        report.total = pendings.length
        report.totalAmount = 0
        // strip to view
        let output = []
        for (let i = 0; i < pendings.length; i++) {
            let entry = pendings[i]
            let view = {}
            view.txid = entry.txid
            view.coin = entry.coin
            view.age = parseInt((time - entry.created) / 1000 / 60)
            // TODO break up by coin

            if (entry.id) view.id = entry.id
            if (entry.confirmations) view.confirmations = entry.confirmations
            if (!entry.confirmations) view.confirmations = 0
            view.amount = entry.amount
            view.source = entry.source
            view.destination = entry.destination
            view.path = entry.source + '_' + entry.destination
            report.unconfirmed = 0
            report.confirmedPending = 0

            report.totalAmount = report.totalAmount + Math.abs(parseInt(entry.amount))

            // get age

            if (entry.confirmations === 0) {
                // Unconfirmed!
                report.unconfirmed = report.unconfirmed + 1
                entry.status = 'AWAITING CONFIRMATION ON BLOCKCHAIN!'
            } else if (entry.confirmations > 0) {
                report.confirmedPending = report.confirmedPending + 1
                entry.status = 'AWAITING CONFIRMATION FROM EXCHANGE!'
            }

            //
            output.push(view)
        }

        // sort by amount
        let sortedOutput = output.sort(function (a, b) { return parseFloat(a.age) - parseFloat(b.age) })

        // display
        for (let i = 0; i < sortedOutput.length; i++) {
            let view = sortedOutput[i]
            await views.smartDisplay(view, ':' + view.coin + ': pending: :' + view.source + ': :arrow_forward: :' + view.destination + ':')
        }

        return report
    },
    clearPending: async function () {
        return pending.clear()
    },
    lookupPending: async function (txid) {
        return redBack.hgetall(txid)
    },
    pendingExchanges: async function () {
        return redBack.smembers('pending:exchanges')
    },

    removePending: async function (txid) {
        return redBack.srem('pendingTx', txid)
    },

    // force clear all pending
    forceClear: async function () {
        return redBack.del('pendingTx')
    },

    // clear individual pending

    // check pending
    checkPending: async function () {
        let tag = TAG + ' | clear Pending | '
        let pendingReport = await pending.clear()
        console.log(tag, 'pendingReport', pendingReport)
        let attachment = views.json(pendingReport, 'Pending Bot actions taken:')

        return attachment
    },

    addPendingExchange: async function (account) {
        if (account === 'poloniex' || account === 'bittrex' || account === 'bitfinex' || account === 'btce' || account === 'kraken') {
            return redBack.sadd('pending:exchanges', account)
        } else {
            return { error: 'invalid exchange: ' + account }
        }
    },
    removePendingExchanges: async function (account) {
        if (account === 'poloniex' || account === 'bittrex' || account === 'bitfinex' || account === 'btce' || account === 'kraken') {
            return redBack.sremove('pending:exchanges', account)
        } else {
            return { error: 'invalid exchange:' + account }
        }
    },
}
