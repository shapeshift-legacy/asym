// dependencies
require('dotenv').config()
const SlackBot = require('slackbots')
const Tokenizer = require('sentence-tokenizer')
const tokenizer = new Tokenizer('reddit')
const uuid = require('node-uuid')
const co = require('co')
const views = require('./modules/views.js')
const nlp = require('./nlp/engine.js')
const config = require('./config')
const log = require("loggerdog-client")()
const balance = require('./modules/auto-balance')
const settings = require('./modules/settings.js')

// config
const TAG = ' | app | '
const botName = 'balanceBot'
config.SLACK_CONFIG.name = botName

// slackbot
const bot = new SlackBot(config.SLACK_CONFIG)
const pmChannel = config.SLACK_CONFIG.pmId // NERF
const defaultChannel = config.SLACK_CONFIG.channelId // NERF
const balanceChannel = config.SLACK_CONFIG.balanceChannelId // NERF
const financeChannel = config.SLACK_CONFIG.financeChannelId
const defaultChannelName = config.SLACK_CONFIG.channel
const financeChannelName = config.SLACK_CONFIG.financeChannel
const paEnabled = config.SLACK_CONFIG.pa
const balancing = config.SLACK_CONFIG.balancing
const finance = config.SLACK_CONFIG.finance

const Redis = require('then-redis')
const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)


const params = {
	icon_emoji: ':shapeshift:',
}

// debug
let session

//Run bot
balance.autonomousOn()
let interval = 60 * 60 // seconds
balance.run()
setInterval(balance.run, interval * 1000)
setInterval(settings.retarget, interval * 1000)
bot.postMessageToChannel(defaultChannelName, botName + ' is fully autonomous!', params)

let checkPending = function () {
	// analyze.pending()
	redBack.del('pendingTx')
}
setInterval(checkPending, 90 * 60 * 1000)



// app on_start
const usersByIndex = {}
const usersByName = {}

bot.on('start', co.wrap(function * () {
    // more information about additional params https://api.slack.com/methods/chat.postMessage
    try {
    	log.debug(" checkpoint startup : ")
        yield bot.getUsers()
            .then(userList => {
                for (let i = 0; i < userList.members.length; i++) {
                    usersByIndex[userList.members[i].id] = userList.members[i].name
                    usersByName[userList.members[i].name] = userList.members[i].id
                }
                // announce
                bot.postMessageToChannel(defaultChannelName, botName + ' is online', params)
            })
    } catch (e) {
        console.error('ERROR: ', e)
    }
}))

/***********************************************
 //        onMessage
 //***********************************************/

// slack
bot.on('message', async function (data) {
    const tag = TAG + ' | OnMessage | '
    try {
        const debug = true
        const verbose = true
        const channel = data.channel

        log.debugv(tag, 'data-pre:', data)
        // save event
        if (data.type === 'reconnect_url') return false
        if (data.type === 'presence_change') return false
        if (data.type === 'user_typing') return false

        // is message
        if (data.type === 'message') {
            if (!data.text) return
            tokenizer.setEntry(data.text)
            let output = tokenizer.getSentences()
            log.debugv(tag, 'output: ', output)
            let tokens = tokenizer.getTokens(output)
            log.debugv(tag, 'tokens: ', tokens)
            //default channel
            log.debugv(tag, 'defaultChannel: ', defaultChannel)
            log.debugv(tag, 'channel: ', channel)

            let response
            switch (channel) {
                case defaultChannel:
                    log.debug(tag, 'default Channel detected')
                    // hot on direct commands
                    // nerfed AI
                    let result = await nlp.respond(tokens, data)
                    log.debug(tag, 'response:', result)
                    log.debug(tag, 'response:', typeof (result))

                    let msg = 'action completed'
                    if (result) {
                        let view
                        if (data.text === 'help') {
                            log.debug(tag, 'Help detected!!!!')
                            view = result
                            msg = 'here is what I can do:'
                        } else if (tokens[0] === 'balancesByAccount' || tokens[0] === 'balancesByCoin' || tokens[0] === 'percentagesByCoin') {
                            view = views.byCoin(result)
                        } else if (tokens[1] === 'balancesByAccount') {
                            view = views.byAccount(result)
                        } else if (tokens[0] === 'history') {
                            view = views.history(result)
                        } else if (typeof (result) === 'object') {
                            view = views.smart(result)
                        } else if (typeof (result) === 'string') {
                            msg = result
                        } else {
                            msg = result
                        }
                        log.debug(tag, 'view:', view)
                        log.debug(tag, 'msg:', msg)

                        bot.postMessageToChannel(defaultChannelName, msg, view)
                    }

                    break

                case balanceChannel:
                    if (balancing) {
                        log.debug(tag, 'balanceChannel Channel detected')
                        // hot on direct commands
                        // nerfed AI
                        let result2 = await nlp.respondBalance(tokens, data)
                        log.debug(tag, 'response:', response)

                        let msg2 = 'action completed'
                        if (result2) {
                            let view
                            if (data.text === 'help') {
                                log.debug(tag, 'Help detected!!!!')
                                view = result2
                                msg2 = 'here is what I can do:'
                            } else if (tokens[0] === 'balancesByAccount' || tokens[0] === 'balancesByCoin' || tokens[0] === 'percentagesByCoin') {
                                view = views.byCoin(result2)
                            } else if (tokens[0] === 'balancesByAccount') {
                                view = views.byAccount(result2)
                            } else if (tokens[0] === 'history') {
                                view = views.history(result2)
                            } else if (typeof (result2) === 'object') {
                                view = views.smart(result2)
                            } else if (typeof (result2) === 'string') {
                                msg2 = result2
                            }
                            log.debug(tag, 'view:', view)
                            log.debug(tag, 'msg:', msg2)

                            views.displayStringToGroupParams(msg2, 'balancing', view)
                        }
                    }

                    break
                case financeChannel:
                    log.debug(tag, 'finance Channel detected')
                    if (finance) {
                        // hot on direct commands
                        log.debug(tag, 'finance Channel detected')
                        let result2 = await nlp.respondFinance(tokens, data)
                        log.debug(tag, 'response:', response)

                        let msg2 = 'action completed'
                        if (result2) {
                            let view
                            if (data.text === 'help') {
                                log.debug(tag, 'Help detected!!!!')
                                view = result2
                                msg2 = 'here is what I can do:'
                            } else if (tokens[0] === 'balancesByAccount' || tokens[0] === 'balancesByCoin' || tokens[0] === 'percentagesByCoin') {
                                view = views.byCoin(result2)
                            } else if (tokens[0] === 'balancesByAccount') {
                                view = views.byAccount(result2)
                            } else if (tokens[0] === 'history') {
                                view = views.history(result2)
                            } else if (typeof (result2) === 'object') {
                                view = views.smart(result2)
                            } else if (typeof (result2) === 'string') {
                                msg2 = result2
                            }

                            log.debug(tag, 'view:', view)
                            log.debug(tag, 'msg:', msg2)
                            console.log(tag, 'financeChannelName: ', financeChannelName)
                            bot.postMessageToChannel(financeChannelName, msg2, view)
                        }
                    }

                    break
                case pmChannel:
                    if (paEnabled) {
                        // hot on direct commands
                        log.debug(tag, 'pmChannel Channel detected')
                        // AI live
                        if (!session) session = uuid.v4()
                        const payload = { input: data.text }
                        response = await nlp.deliberate(session, data, payload)
                        log.debug(tag, 'response:', response)

                        let view = views.smartParams(response)

                        let params = view.params
                        let text = view.text

                        log.debug(tag, 'params:', params)
                        log.debug(tag, 'text:', text)

                        bot.postMessageToUser(usersByIndex[data.user], text, params)
                    }

                    break
                case null:
                    break
                default:
                    break
            }
        }
    } catch (e) {
        log.error(tag, 'e', e)
    }
})
