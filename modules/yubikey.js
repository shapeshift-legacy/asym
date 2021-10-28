/**
 * Created by highlander on 4/3/17.
 */

let request = require('request')
// const async = require('asyncawait/async')
// const await = require('asyncawait/await')
let when = require('when')
let TAG = ' | yubikey | '
let debug = false
let SlackBot = require('slackbots')
let yub = require('yub')
let whitelisted_yubikeys = require('../shapeshift-whitelists-tracked/yubikeys.js')

const config = require('../config')
yub.init(config.YUBIKEY_CONFIG.pub, config.YUBIKEY_CONFIG.priv)

let valid = Object.keys(whitelisted_yubikeys)
let users = whitelisted_yubikeys

module.exports = {
    authenticate: function (auth) {
        return authenticate_press(auth)
    },
}

var authenticate_press = async function (auth) {
    let tag = TAG + ' | authenticate_press | '
    let debug = true
    try {
        let success = await yubikey(auth)
        if (debug) console.log(tag, 'success:', success)

        // default to error
        let output = {
            success: false,
            msg: ' Im afraid I cant let you do that dave! '
        }
        if (success) {
            output.success = true
            output.identity = success.identity
            output.user = users[success.identity]
            output.msg = 'user: ' + users[success.identity] + ' approved'
        }
        return output
    } catch (e) {
        console.error(tag, 'ERROR:', e)
    }
}

var yubikey = function (auth) {
    let d = when.defer()
    let tag = TAG + ' | yubikey | '
    let output
    let debug = true
    yub.verify(auth, function (err, data) {
        if (debug) console.log(tag, 'data:', data)
        if (debug) console.log(tag, 'err:', data)
        if (!err && data.valid && data.signatureVerified && data.nonceVerified && valid.indexOf(data.identity) >= 0) {
            console.log(tag, ' Successful AUTH: ')
            d.resolve(data)
        } else {
            console.error(tag, ' Failed to auth! err: ', err)
            d.resolve(false)
        }
    })

    return d.promise
}
