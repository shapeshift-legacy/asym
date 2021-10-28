/**
 * Created by highlander on 6/26/17.
 */
const SlackBot = require('slackbots')
const config = require('../config')
const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)
// bot
const botName = 'balanceBot'
config.SLACK_CONFIG.name = botName
const bot = new SlackBot(config.SLACK_CONFIG)
const defaultChannelName = config.SLACK_CONFIG.channel

let online = false
const usersByIndex = {}
const usersByName = {}
bot.on('start', async function () {
    // more information about additional params https://api.slack.com/methods/chat.postMessage
    try {
        let userList = await bot.getUsers()

        for (let i = 0; i < userList.members.length; i++) {
            usersByIndex[userList.members[i].id] = userList.members[i].name
            usersByName[userList.members[i].name] = userList.members[i].id
            // yield redis.hset(memberArray.members[i].id, "username", memberArray.members[i].name)
        }
        // console.log("usersArray: ",usersByIndex)
        // console.log("usersByName: ",usersByName)
        online = true
    } catch (e) {
        console.error('ERROR: ', e)
    }
})

const TAG = ' | Views | '
module.exports = {
    onCall: function (msg) {
        return alert_onCall(msg)
    },
    channel: function (msg, channel) {
        return alert_channel(msg, channel)
    },
    user: function (user, msg) {
        return alert_user(user, msg)
    },
}

const alert_user = async function (user, msg) {
    const tag = TAG + ' | alert_user | '
    const debug = false
    try {
        let attachments = []
        const params = {
            icon_emoji: ':shapeshift:',
            attachments: attachments
        }

        let string = '<@' + usersByName[user] + '> ' + msg

        if (debug) console.log(tag, 'string: ', string)
        bot.postMessageToChannel(defaultChannelName, string, params)
        return true
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const alert_channel = async function (msg, channel) {
    const tag = TAG + ' | alert_channel | '
    const debug = false
    try {
        let attachments = []
        const params = {
            icon_emoji: ':shapeshift:',
            attachments: attachments
        }
        if (debug) console.log(tag, 'attachments: ', attachments)

        bot.postMessageToChannel(channel, msg, params)
        return true
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

const alert_onCall = async function (msg) {
    const tag = TAG + ' | alert_onCall | '
    const debug = false
    try {
        let attachments = []
        const params = {
            icon_emoji: ':shapeshift:',
            attachments: attachments
        }
        if (debug) console.log(tag, 'attachments: ', attachments)

        let alerts = ''
        let alertUsers = await redBack.smembers('alertUsers')
        for (let i = 0; i < alertUsers.length; i++) {
            alerts = alerts + '<@' + usersByName[alertUsers[i]] + '>'
        }
        alerts = alerts + '  msg: ' + msg
        bot.postMessageToChannel('alerts', alerts, params)
        return true
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}
