/**
 * Created by highlander on 5/27/17.
 */
/**
 * Created by highlander on 2/11/17.
 */
const config = require('../config')
const TAG = ' | nlp-engine | '

const Redis = require('then-redis')
const redis = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)
const events = require('events')
// const eventEmitter = new events.EventEmitter();
const Tokenizer = require('sentence-tokenizer')
const tokenizer = new Tokenizer('reddit')
const fs = require('fs')
// const aiml = require("./modules/aiml.js")

const rive = require('./../nlp/rive.js')

const describe = require('./../modules/describe.js')
const views = require('./../modules/views.js')

// integrations
const integrations = {}
const run = require('./../commands/run.js')
integrations['run'] = run
const actions = require('./../commands/actions.js')
integrations['actions'] = actions
const alerts = require('./../commands/alerts.js')
integrations['alerts'] = alerts
// const reports = require('./../commands/reports.js')
// integrations['reports'] = reports
const rules = require('./../commands/rules.js')
integrations['rules'] = rules
const balances = require('./../commands/balances.js')
integrations['balances'] = balances
const settings = require('./../commands/settings.js')
integrations['settings'] = settings
const status = require('./../commands/status.js')
integrations['status'] = status
const pending = require('./../commands/pending.js')
integrations['pending'] = pending
// const lookup = require('./../commands/lookup.js')
// integrations['lookup'] = lookup
const test = require('./../commands/test.js')
integrations['test'] = test
// const audit = require('./../commands/audit.js')
// integrations['audit'] = audit
// const exchanges = require('./../commands/exchanges.js')
// integrations['exchanges'] = exchanges
const coins = require('./../commands/coins.js')
integrations['coins'] = coins

const reports = require('./../commands/reports.js')
integrations['reports'] = reports

// const history = require('./../commands/history.js')
// integrations['history'] = history
// modules
// const shapeshift = require('./../modules/shapeshift.js')
// integrations['shapeshift'] = shapeshift
// const coincap = require('./../modules/coincap.js')
// integrations['coincap'] = coincap

const integrationsIndex = Object.keys(integrations)

// Finance modules

const integrationsFIN = {}
const history = require('./../commands/history.js')
integrationsFIN['history'] = history
const exchanges = require('../commands/exchanges.js')
integrationsFIN['exchanges'] = exchanges
const lookup = require('./../commands/lookup.js')
integrationsFIN['lookup'] = lookup
// const reports = require('./../commands/reports.js')
// integrationsFIN['reports'] = reports
const audit = require('./../commands/audit.js')
integrationsFIN['audit'] = audit

// let intergrationsExtended = integrations
// const balancesM = require('./../modules/balances.js')
// intergrationsExtended['balancesM'] = balancesM
// // const climate = require('./../modules/climate.js')
// // intergrationsExtended['climate'] = climate
// const coins = require('./../modules/coins.js')
// intergrationsExtended['coins'] = coins
// const report = require('./../modules/report.js')
// intergrationsExtended['report'] = report
//
// //exchanges
// const kraken = require('./../exchanges/kraken-client.js')
// intergrationsExtended['kraken'] = kraken
// const bittrex = require('./../exchanges/bittrex-client.js')
// intergrationsExtended['bittrex'] = bittrex
// const poloniex = require('./../exchanges/poloniex-client.js')
// intergrationsExtended['poloniex'] = poloniex
// const bitfinex = require('./../exchanges/bitfinex-client.js')
// intergrationsExtended['bitfinex'] = bitfinex

// const commands = {
//
// }

module.exports = {
    // initialize
    // run: function () {
    //     return eventEmitter
    // },
    deliberate: function (session, data, payload) {
        return deliberate_on_input(session, data, payload)
    },
    respond: function (tokens, data) {
        return respond_to_input(tokens, data)
    },

    respondBalance: function (tokens, data) {
        return respond_to_input_balance(tokens, data)
    },

    respondFinance: function (tokens, data) {
        return respond_to_input_finance(tokens, data)
    },
}

/*****************************************
 // Primary
 //*****************************************/

// const test = function(){
//     eventEmitter.emit('talk','hello!')
// }

const respond_to_input_finance = async function (tokens, data) {
    const tag = TAG + ' | respond_to_input_balance | '
    const debug = false
    const verbose = false
    try {
        let commands = []
        let commandMap = {}

        Object.keys(integrationsFIN).forEach(function (integration) {
            const map = describe.map(integrationsFIN[integration])
            if (verbose) console.log(tag, 'map: ', map)
            Object.keys(map).forEach(function (key) {
                commands.push(key)
                commandMap[key] = integration
            })
        })
        if (debug) console.log(tag, 'commands: ', commands)

        //! balances

        //! send 1000 nmc from hot to polo ccccccggidrvbhbgrigfjiguvvdbvnvhkjkvnnkdtedr

        // if help in any channel
        if (data.text === 'help') {
            if (verbose) console.log(tag, 'help command detected')
            let channel = 'finance-toolkit'
            views.helpByChannel(integrationsFIN, channel)
        }

        if (debug) console.log(tag, 'commands:', commands)
        if (verbose) console.log(tag, 'commandMap:', commandMap)
        if (commands.indexOf(tokens[0]) >= 0) {
            if (debug) console.log(tag, ' command detected! ')
            let output = null
            // if(!integrations[tokens[0]]) throw "ERROR:101 Intergration not found! "+tokens[0]
            // if(!integrations[tokens[0]][tokens[1]]) throw "ERROR:102 Intergration command not found! "+tokens[0][tokens[1]]

            // can default to auth ON
            const auth = false
            // detect if Auth needed
            // if(tokens[1] === "perform") auth = true
            // if(tokens[1] === "performAll") auth = true

            // if (auth) {
            //     //get last param
            //     const authHash = tokens[tokens.length - 1]
            //     //remove auth from params
            //     if (debug && verbose) console.log(tag, "tokens: ", tokens)
            //     tokens = tokens.splice(0, tokens.length - 1)
            //     if (debug && verbose) console.log(tag, "tokens: ", tokens)
            //
            //     if (debug) console.log(tag, "authHash: ", authHash)
            //
            //     //get username
            //     const user = authHash.substring(0, 12)
            //
            //     //if authorized request yubico
            //     if (authorized.indexOf(user)) {
            //         //ping yubico
            //         const success = await verify_yubikey(authHash)
            //         if (!success) throw "ERROR:103 Failed to Auth!!! "
            //     } else {
            //         output = " UnAthorized User!!! " + user
            //     }
            // }

            if (verbose) console.log(tag, 'tokens: ', tokens)
            let params = []
            if (tokens[0] === 'info') {
                params = [data.user]
            }

            if (tokens[1]) {
                params = tokens.splice(1)
            }

            if (tokens[0] === 'register' || tokens[0] === 'deposit') {
                params.push(data.user)
            }
            if (debug) console.log(params)
            if (debug) console.log(tag, 'tokens: ', tokens)
            if (verbose) console.log(tag, 'integrations: ', integrations)
            let intergration = commandMap[tokens[0]]
            if (debug) console.log(tag, 'intergration: ', intergration)
            const result = await integrationsFIN[intergration][tokens[0]].apply(this, params)
            console.log(tag, 'result:', result)

            return result
        } else {
            // only hit on commands
            return null
        }
    } catch (e) {
        console.error(e)
    }
}

const respond_to_input_balance = async function (tokens, data) {
    const tag = TAG + ' | respond_to_input_balance | '
    const debug = false
    const verbose = false
    try {
        let commands = []
        let commandMap = {}

        Object.keys(integrations).forEach(function (integration) {
            const map = describe.map(integrations[integration])
            if (verbose) console.log(tag, 'map: ', map)
            Object.keys(map).forEach(function (key) {
                commands.push(key)
                commandMap[key] = integration
            })
        })
        if (debug) console.log(tag, 'commands: ', commands)

        //! balances

        //! send 1000 nmc from hot to polo

        let helpInfo = [
            {
                send: 'send [amount] [coin] from [source] to [destination]'
            },
            {
                balances: ' (output all balances)',
                balance: ' [coin] (display coin balances)'
            }
        ]

        // if help in any channel
        if (data.text === 'help') {
            if (verbose) console.log(tag, 'help command detected')
            let params = views.displayArrayToChannel(helpInfo, 'balancing-g2', 'balancing tools')
            if (verbose) console.log(tag, 'params:', params)
            if (debug) console.log(tag, 'channel: ', data.channel)
            // bot.postMessageToUser(usersByIndex[data.user],"Here is what I can do:", params);
            return params
        }

        if (tokens[0] === 'send' || tokens[0] === 'send') {
            //! send 1000 nmc from hot to polo

            // remap format to balance
            let coin = tokens[2]
            let amount = tokens[1]
            let source = tokens[4]
            let destination = tokens[6]
            let auth = tokens[7]

            if (source === 'polo') source = 'poloniex'
            if (destination === 'polo') source = 'poloniex'
            if (destination === 'hizzy') destination = 'hot'
            if (source === 'hizzy') source = 'hot'

            tokens = ['balance', coin, amount, source, destination, auth]
            if (debug) console.log(tag, 'remapped send command: ', tokens)
        }

        if (debug) console.log(tag, 'commands:', commands)
        if (verbose) console.log(tag, 'commandMap:', commandMap)
        if (commands.indexOf(tokens[0]) >= 0) {
            if (debug) console.log(tag, ' command detected! ')
            let output = null
            // if(!integrations[tokens[0]]) throw "ERROR:101 Intergration not found! "+tokens[0]
            // if(!integrations[tokens[0]][tokens[1]]) throw "ERROR:102 Intergration command not found! "+tokens[0][tokens[1]]

            // can default to auth ON
            const auth = false
            // detect if Auth needed
            // if(tokens[1] === "perform") auth = true
            // if(tokens[1] === "performAll") auth = true

            if (auth) {
                // get last param
                const authHash = tokens[tokens.length - 1]
                // remove auth from params
                if (debug && verbose) console.log(tag, 'tokens: ', tokens)
                tokens = tokens.splice(0, tokens.length - 1)
                if (debug && verbose) console.log(tag, 'tokens: ', tokens)

                if (debug) console.log(tag, 'authHash: ', authHash)

                // get username
                const user = authHash.substring(0, 12)

                // if authorized request yubico
                if (authorized.indexOf(user)) {
                    // ping yubico
                    const success = await verify_yubikey(authHash)
                    if (!success) throw 'ERROR:103 Failed to Auth!!! '
                } else {
                    output = ' UnAthorized User!!! ' + user
                }
            }

            if (verbose) console.log(tag, 'tokens: ', tokens)
            let params = []
            if (tokens[1]) {
                params = tokens.splice(1)
                if (debug) console.log(params)
            }

            if (debug) console.log(tag, 'tokens: ', tokens)
            if (verbose) console.log(tag, 'integrations: ', integrations)
            let intergration = commandMap[tokens[0]]
            if (debug) console.log(tag, 'intergration: ', intergration)
            const result = await integrations[intergration][tokens[0]].apply(this, params)
            console.log(tag, 'result:', result)

            return result
        } else {
            // only hit on commands
            return null
        }
    } catch (e) {
        console.error(e)
    }
}

const respond_to_input = async function (tokens, data) {
    const tag = ' | respond_to_input | '
    const debug = false
    const verbose = false
    try {
        let commands = []
        let commandMap = {}

        Object.keys(integrations).forEach(function (integration) {
            const map = describe.map(integrations[integration])
            if (verbose) console.log(tag, 'map: ', map)
            Object.keys(map).forEach(function (key) {
                commands.push(key)
                commandMap[key] = integration
            })
        })

        // if help in any channel
        if (data.text === 'help') {
            if (verbose) console.log(tag, 'help command detected')
            let params = views.help(integrations)
            if (verbose) console.log(tag, 'params:', params)
            if (debug) console.log(tag, 'channel: ', data.channel)
            // bot.postMessageToUser(usersByIndex[data.user],"Here is what I can do:", params);
            return params
        }

        if (debug) console.log(tag, 'commands:', commands)
        if (verbose) console.log(tag, 'commandMap:', commandMap)
        if (commands.indexOf(tokens[0]) >= 0) {
            if (debug) console.log(tag, ' command detected! ')
            let output = null
            // if(!integrations[tokens[0]]) throw "ERROR:101 Intergration not found! "+tokens[0]
            // if(!integrations[tokens[0]][tokens[1]]) throw "ERROR:102 Intergration command not found! "+tokens[0][tokens[1]]

            // can default to auth ON
            const auth = false
            // detect if Auth needed
            // if(tokens[1] === "perform") auth = true
            // if(tokens[1] === "performAll") auth = true

            if (auth) {
                // get last param
                const authHash = tokens[tokens.length - 1]
                // remove auth from params
                if (debug && verbose) console.log(tag, 'tokens: ', tokens)
                tokens = tokens.splice(0, tokens.length - 1)
                if (debug && verbose) console.log(tag, 'tokens: ', tokens)

                if (debug) console.log(tag, 'authHash: ', authHash)

                // get username
                const user = authHash.substring(0, 12)

                // if authorized request yubico
                if (authorized.indexOf(user)) {
                    // ping yubico
                    const success = await verify_yubikey(authHash)
                    if (!success) throw 'ERROR:103 Failed to Auth!!! '
                } else {
                    output = ' UnAthorized User!!! ' + user
                }
            }

            if (verbose) console.log(tag, 'tokens: ', tokens)
            let params = []
            if (tokens[1]) {
                params = tokens.splice(1)
                if (debug) console.log(params)
            }

            if (debug) console.log(tag, 'tokens: ', tokens)
            if (verbose) console.log(tag, 'integrations: ', integrations)
            let intergration = commandMap[tokens[0]]
            if (debug) console.log(tag, 'intergration: ', intergration)
            const result = await integrations[intergration][tokens[0]].apply(this, params)
            console.log(tag, 'result:', result)

            return result
        } else {
            // only hit on commands
            return null
        }
    } catch (e) {
        console.error(e)
    }
}

const deliberate_on_input = async function (session, data, payload) {
    const tag = ' | deliberate_on_input | '
    const debug = true
    const debug1 = false
    try {
        if (debug) console.log(tag, 'source: ', data)

        // save context
        await (redis.sadd(session, payload.input))

        // Who am I talking too?
        let userInfo = await redis.hgetall(data.user)
        if (!userInfo) await redis.hmset(data.user, data)
        userInfo = data
        if (debug) console.log(tag, 'userInfo: ', userInfo)

        // under what context?
        const context = await redis.smembers(session)
        if (debug) console.log(tag, 'context: ', context)

        // commands
        // let commands = detect_commands(context)

        // state
        // let state = await( redis.hgetall()

        // change of state

        tokenizer.setEntry(payload.input)
        const sentences = tokenizer.getSentences()
        if (debug) console.log(tag, 'sentences: ', sentences)

        const source = 'slack'

        const tokens = tokenizer.getTokens(sentences)
        if (debug) console.log(tag, 'tokens: ', tokens)

        //
        const output = []

        // preprocessing
        let state = null
        if (userInfo.state) state = parseInt(userInfo.state)
        if (state) {
            switch (state) {
                case 1:
                    await redis.hset(data.user, 'state', 0)

                    break
                case 2:
                    // a command was handled and action taken
                    output.push('Ok, lets learn something')
                    // save?
                    break
                case null:

                    // ignore
                    break
                default:
                    // let response = await( rive.respond(sentences[i])
                    // output.push(response)
                    break
            }
        }

        // for each sentence
        for (let i = 0; i < sentences.length; i++) {
            switch (tokens[0]) {
                case 'help':
                    output.push('this is a unhelpfull help message.')
                    break
                case 'learn':
                    // a command was handled and action taken

                    // MUST have CHAL:  and RESP:
                    let chalPlacement = tokens.indexOf('CHAL:')
                    let respPlacement = tokens.indexOf('RESP:')
                    if (chalPlacement >= 0 && respPlacement >= 0) {
                        // write RIVE
                        // if CMD: assume command
                        // is command logical?

                        // else string
                        // combine tokens
                        let chalStart = chalPlacement + 1
                        let respStart = respPlacement
                        let trigger = ''
                        for (let i = chalStart; i < respPlacement; i++) {
                            trigger = trigger + ' ' + tokens[i]
                        }

                        let response = ''
                        for (i = respPlacement + 1; i < tokens.length; i++) {
                            if (tokens[i] == '&lt;star&gt;') {
                                response = response + ' <star>'
                            } else {
                                response = response + ' ' + tokens[i]
                            }
                        }

                        let success = await rive.create(trigger, response)
                        if (debug) console.log(tag, 'success: ', success)
                    } else {
                        // else failed to learn
                        // dump how to learn
                        output.push('not a valid lession asshole! requirements CHAL: AND RESP:')
                    }

                    break
                case 'state':
                    output.push('state is ' + state)
                    // ignore
                    break
                default:
                    const response = await (rive.respond(sentences[i]))
                    if (response != 'ERR: No Reply Matched') {
                        output.push(response)
                    }

                    break
            }
        }

        // rivescript commands
        for (let i = 0; i < output.length; i++) {
            if (debug) console.log(tag, 'output: ', output[i])
            // if contains a CMD: assume command
            if (output[i] && output[i].indexOf('CMD:') >= 0) {
                //
                if (debug) console.log(tag, 'split: ', output[i].split(':'))
                const command = output[i].split(':')[1]
                if (debug) console.log(tag, 'command: ', command)

                //
                tokenizer.setEntry(command)
                const commandSentences = tokenizer.getSentences()
                if (debug) console.log(tag, 'commandSentences: ', commandSentences)
                const commandTokens = tokenizer.getTokens(command)
                if (debug) console.log(tag, 'commandTokens: ', commandTokens)

                let params = []
                let result
                if (commandTokens[2]) {
                    params = commandTokens.splice(2)
                    if (debug) console.log(params)
                    // if(integrations[commandTokens[0]][commandTokens[1]]) result = await(integrations[commandTokens[0]][commandTokens[1]].apply(this,params))
                    //     else console.error(tag," invalid command! ",commandTokens)
                }
                // else {
                //     console.log("******* no params detected")
                //     console.log("******* integrations ",integrations)
                //     result = await(integrations[commandTokens[0]][commandTokens[1]]())
                //
                //     console.log(tag,"result:", result)
                // }

                if (debug1) console.log(tag, 'params: ', params)
                if (debug1) console.log(tag, 'integrations: ', integrations)
                if (debug1) console.log(tag, 'commandTokens: ', commandTokens)

                if (integrations[commandTokens[0]][commandTokens[1]]) result = await (integrations[commandTokens[0]][commandTokens[1]].apply(this, params))
                else console.error(tag, ' invalid command! ', commandTokens)

                console.log(tag, 'result:', result)

                // const view = create_view_smart(result)
                // console.log(tag,"view:", view)
                output.push(JSON.stringify(result))
            }
        }

        if (output.length == 0) {
            // if unknowns use api's

        }

        // remove commands
        for (let i = 0; i < output.length; i++) {
            if (output[i].indexOf('CMD:') >= 0) {
                output.splice(i, 1)
            }
        }

        // summarize

        return output
    } catch (e) {
        console.error(e)
    }
}

// strategies

// Get information from user

// user profile

// prompt on unknown info

// Set reminder

// alert on event

// use idle time to collect info

// use idle time to digest knowledge/train

// exports.run = run;
/*****************************************
 // Lib
 //*****************************************/
