/**
 * Created by highlander on 5/30/17.
 */

const config = require('../config')
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

const alerts = require('../modules/alert')

module.exports = {

    alertUsers: function () {
        return redBack.smembers('alertUsers')
    },
    alertAdd: function (user) {
        return redBack.sadd('alertUsers', user)
    },
    alertRemove: function (user) {
        return redBack.srem('alertUsers', user)
    },
    testAlertUser: function (user, msg) {
        return alerts.user(user, msg)
    },
    testAlertChannel: function (msg, channel) {
        return alerts.channel(msg, channel)
    },
    testAlertOnCall: function (msg) {
        return alerts.onCall(msg)
    },
}
