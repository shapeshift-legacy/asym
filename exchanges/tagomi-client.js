
/*
    Highlander tagomi client

    https://api.tagomi.com

    client
    <redacted>

 */

let TAG  = " | Tagomi | "
let log = require('loggerdog-client')()
var request = require("request-promise");
const config = require('../config')

let OATH_TOKEN
let Redis = require('then-redis')
let redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)


module.exports = {
    init: function () {
        return init_client();
    },
    withdrawal: function (currency,amount,address) {
        return withdraw(currency,amount,address);
    },
    withdraw: function (currency,amount,address) {
        return withdraw(currency,amount,address);
    },
    getWallets: function () {
        return get_wallets();
    },
    getAccounts: function () {
        return get_accounts();
    },


}

const get_accounts = async function(){
    let tag = TAG + " | Tagomi withdraw | "
    let debug = false
    try{

        var options = { method: 'GET',
            url: 'https://api.tagomi.com/v1/instruments',
            headers:
                { 'cache-control': 'no-cache',
                    Connection: 'keep-alive',
                    'Accept-Encoding': 'gzip, deflate',
                    Host: 'api.tagomi.com',
                    'Postman-Token': '<redacted>',
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'PostmanRuntime/7.19.0',
                    Authorization: 'Bearer '+OATH_TOKEN,
                    'content-type': 'application/x-www-form-urlencoded',
                    accept: 'application/json' } };

        let response = await request(options)
        response = JSON.parse(response)
        log.debug(tag,"response: ",response)

        let output = {}
        for(let i = 0; i < response.length; i++){
            let instruments = response[i]
            output[instruments.symbol] = instruments.id
        }


        return output
    }catch(e){
        log.error(tag,"Error: ",e)
    }
}



const get_wallets = async function(){
    let tag = TAG + " | withdraw | "
    let debug = false
    try{

        var options = { method: 'GET',
            url: 'https://api.tagomi.com/v1/accounts/366/wallets',
            headers:
                { 'cache-control': 'no-cache',
                    Connection: 'keep-alive',
                    'Accept-Encoding': 'gzip, deflate',
                    Host: 'api.tagomi.com',
                    'Postman-Token': '<redacted>',
                    'Cache-Control': 'no-cache',
                    'User-Agent': 'PostmanRuntime/7.19.0',
                    Authorization: 'Bearer '+OATH_TOKEN,
                    'content-type': 'application/x-www-form-urlencoded',
                    accept: 'application/json' } };

        let response = await request(options)
        response = JSON.parse(response)
        log.debug(tag,"response: ",response)

        let output = {}
        for(let i = 0; i < response.length; i++){
            let wallet = response[i]
            output[wallet.address] = wallet.id
        }


        return output
    }catch(e){
        log.error(tag,"Error: ",e)
    }
}


const withdraw = async function(currency,amount,address){
    let tag = TAG + " | withdraw | "
    let debug = false
    try{
        //get walletId from address
        let wallets = await get_wallets()
        //amount = amount.toString()
        let walletId =  wallets[address]
        if(!walletId) throw Error("102: address not found in tagomi wallets whitelist (remote error)")

        let instruments = await get_accounts()
        if(!instruments) throw Error("101: failed to get instruments!")
        let instrumentId = instruments[currency.toUpperCase()]
        if(!instrumentId) throw Error("103: currentcy not found in tagomi intstrument list! "+currency)

        //get account id from asset
        var options = { method: 'POST',
            url: 'https://api.tagomi.com/v1/withdrawals',
            headers:
                {
                    'Postman-Token': '<redacted>',
                    'cache-control': 'no-cache',
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer '+OATH_TOKEN,
                    accept: 'application/json' },
            body:
                {
                    "amount": amount,
                    "accountId": 366,
                    "walletId": walletId,
                    "instrumentId": instrumentId
                },
            json: true };

        log.info(tag,"options: ",options)
        let response = await request(options)
        log.info(tag,"response: ",response)

        let output = {}
        output.success = false

        if(response.error){
            output.error = reponse.message
        }

        //response = JSON.parse(response)
        //log.info(tag,"response: ",response)

        if(response.id){
            output.success = true
            output.id = response.id
        }

        return output
    }catch(e){
        //log.error(tag,"Error: ",e)

        let output = {}
        output.success = false
        if(e.error && e.message){
            output.error = e.message
        } else if(e){
            output.error = e
        }

        return output
    }
}

const init_client = async function () {
    let tag = TAG + " | init_wallet | "
    try {
        //
        let token = await redBack.get("TAGOMI_TOKEN")
        if(token){
            log.info(tag,"token: ",token)
            OATH_TOKEN = token
        } else {
            //get bearer token
            var options = {
                method: 'POST',
                url: 'https://auth.tagomi.com/oauth2/default/v1/token',
                qs:
                    { grant_type: 'client_credentials',
                        scope: 'api',
                        redirect_uri: '/' },
                headers:
                    { 'cache-control': 'no-cache',
                        Connection: 'keep-alive',
                        'Content-Length': '0',
                        'Accept-Encoding': 'gzip, deflate',
                        Host: 'auth.tagomi.com',
                        'Postman-Token': '<redacted>',
                        'Cache-Control': 'no-cache',
                        'User-Agent': 'PostmanRuntime/7.19.0',
                        Authorization: 'Basic '+config.EXCHANGES_CONFIG.Credentials.tagomi.auth,
                        'content-type': 'application/x-www-form-urlencoded',
                        accept: 'application/json' } };

           // console.log(options)
            let response = await request(options)
            response = JSON.parse(response)
            log.info(tag,"response: ",response)
            log.info(tag,"token: ", response.access_token)

            OATH_TOKEN = response.access_token
            if(response.access_token){
                await redBack.setex("TAGOMI_TOKEN",600,OATH_TOKEN)
            }
        }

        return true
    } catch (e) {
        log.error(tag, "e: ", e)
    }
}

/*********************************************
 // LIB
 //*********************************************/

