/**
 * Created by highlander on 11/30/16.
 */
//
let request = require('request')
let when = require('when')
let TAG = ' | coins | '
// var url = "http://127.0.0.1:3001"
// var sentinelUrl = "http://localhost:3001"

const config = require('../config')

let servers = config.COIN_SERVERS
// console.log("Chappi: ", servers)
let debug = false
module.exports = {
    //
    // getInfo: function (coin)
    // {
    //     return get_blockchain_info(coin);
    // },
    //
    // getNewAddress: function (coin)
    // {
    //     return get_new_address(coin);
    // },
    //
    // listSinceLastblock: function (block, coin)
    // {
    //     return list_since_last_block_with_unconfirmed(block, coin);
    // },
    //
    // listSinceBlock: function (block, coin)
    // {
    //     return list_since_block(block, coin);
    // },
    //
    getBlockCount: function (coin) {
        return get_block_height(coin)
    },
    //
    // getBlockHash: function (blockcount, coin)
    // {
    //     return get_block_hash_from_height(blockcount, coin);
    // },
    //
    // getReceivedByAddress: function (address)
    // {
    //     return get_recieved_by_address(address);
    // },
    //
    // getBalance: function (coin)
    // {
    //     return get_balance(coin);
    // },
    getAddressBalance: function (coin) {
        return get_address_balance(coin)
    },
    //
    // getBalance_MP: function (coin, address, code)
    // {
    //     return get_balance_MP(coin, address, code);
    // },
    //
    // validateAddress: function (coin, address)
    // {
    //     return validate_address(coin, address);
    // },

    getTransaction: function (tx, coin) {
        return get_transaction_details(tx, coin)
    },

    // getTransfers: function (coin)
    // {
    //     return get_transfers(coin);
    // },

    sendFrom: function (source, destination, amount) {
        return send_from(source, destination, amount)
    },
    //
    // getRawTransaction: function (tx, coin)
    // {
    //     return get_raw_transaction_details(tx, coin);
    // },
    //
    // decodeRawTransaction: function (tx, coin)
    // {
    //     return decode_raw_transaction(tx, coin);
    // }
}

/***************************************
 //    Primary Functions
 //***************************************/
//
// var get_balance_MP = function (coin,address,code)
// {
//     var d = when.defer();
//     var tag = TAG+" | get_balance_MP | "
//     coin = coin.toLowerCase()
//     if (!coin)
//     {
//         console.error("Coin undefined!");
//         d.reject("Coin undefined! ");
//     }
//
//
//     var url = servers[coin]
//     url = url + ":3001"
//
//     if(debug) console.log(tag,"url: ",url)
//     if(debug) console.log(tag,"body: ",body)
//     post_request(url, "getBalance_MP", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 if(debug) console.log("get balance for ", resp)
//                 d.resolve( resp)
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             d.reject(error)
//         })
//
//     return d.promise
// }
//
// var get_blockchain_info = function (coin)
// {
//     var d = when.defer();
//     var tag = TAG+" | get_blockchain_info | "
//
//     if (!coin)
//     {
//         console.error("Coin undefined!");
//         d.reject("Coin undefined! ");
//     }
//     //console.log("callback: ",callback)
//     //console.log("coin: ",coin)
//     coin = coin.toLowerCase()
//
//     var body = {
//         coin: coin
//     }
//     //d.reject("ERROR: empty response!")
//
//     //use correct server
//     var url = servers[coin]
//     url = url + ":3001"
//     //console.log(tag," getInfo: ",body,url+":3001")
//     post_request(url, "getInfo", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 //console.log("resp: ", resp)
//                 d.resolve( resp)
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             d.reject(error)
//         })
//
//     return d.promise
// }
//
// var list_since_block = function (block, coin)
// {
//     var d = when.defer();
//     var tag = TAG+" | list_since_block | "
//     if (!coin)
//     {
//         console.error("Coin undefined!");
//         d.reject("Coin undefined! ");
//     }
//     coin = coin.toLowerCase()
//
//     var body = {
//         coin: coin,
//         block: block
//     }
//     var url = servers[coin]
//     url = url + ":3001"
//     //
//     post_request(url, "listSinceLastblock", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 //console.log("resp: ", resp)
//
//                 try
//                 {
//                     resp = JSON.parse(resp)
//                     d.resolve( resp)
//                 } catch (e)
//                 {
//                     d.reject("ERROR: bad json!")
//                 }
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             console.error(tag, "Error: ", error, " body: ", body)
//             d.reject(error)
//         })
//
//     return d.promise
// }
//
// var get_balance = function (coin)
// {
//     var d = when.defer();
//     var tag = TAG+" | get_balance | "
//     coin = coin.toLowerCase()
//     if (!coin)
//     {
//         console.error("Coin undefined!");
//         d.reject("Coin undefined! ");
//     }
//
//     var body = {
//         coin: coin
//     }
//     var url = servers[coin]
//     url = url + ":3001"
//     console.log(tag,"url: ",url)
//     post_request(url, "getBalance", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 //console.log("get balance for "+coin+"  resp: ", resp)
//                 d.resolve( resp)
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             d.reject(error)
//         })
//
//     return d.promise
// }
//
// var get_block_height = function (coin)
// {
//     var d = when.defer();
//     var tag = TAG+" | get_blockchain_info | "
//     if (!coin)
//     {
//         console.error("Coin undefined!");
//         d.reject("Coin undefined! ");
//     }
//     coin = coin.toLowerCase()
//
//     var body = {
//         coin: coin
//     }
//     var url = servers[coin]
//     url = url + ":3001"
//     post_request(url, "getBlockCount", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 //console.log("resp: ", resp)
//                 d.resolve( resp)
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             d.reject(error)
//         })
//
//     return d.promise
// }

var get_transaction_details = function (tx, coin) {
    let d = when.defer()
    let tag = TAG + ' | get_blockchain_info | '
    coin = coin.toLowerCase()

    let body = {
        coin: coin,
        tx: tx
    }
    // var url = servers[setting1[coin]]
    let url = servers[coin]
    url = url + ':3001'
    post_request(url, 'getTransaction', body)
        .then(function (resp) {
            if (resp) {
                console.log(tag, 'resp: ', resp)
                if (typeof (resp) === 'string') resp = JSON.parse(resp)
                d.resolve(resp)
            } else {
                d.reject('ERROR: empty response!')
            }
        })
        .catch(function (error) {
            d.reject(error)
        })

    return d.promise
}

var send_from = function (source, destination, amount) {
    let d = when.defer()
    let tag = TAG + ' | send_from | '
    coin = coin.toLowerCase()

    let body = {
        coin: 'eth',
        source,
        destination,
        amount
    }
    // var url = servers[setting1[coin]]
    let url = servers[coin]
    url = url
    post_request(url, 'sendFrom', body)
        .then(function (resp) {
            if (resp) {
                console.log(tag, 'resp: ', resp)
                if (typeof (resp) === 'string') resp = JSON.parse(resp)
                d.resolve(resp)
            } else {
                d.reject('ERROR: empty response!')
            }
        })
        .catch(function (error) {
            d.reject(error)
        })

    return d.promise
}

// var get_raw_transaction_details = function (tx, coin)
// {
//     var d = when.defer();
//     var tag = TAG+" | get_blockchain_info | "
//     coin = coin.toLowerCase()
//
//     var body = {
//         coin: coin,
//         tx: tx
//     }
//     //var url = servers[setting1[coin]]
//     var url = servers[coin]
//     url = url + ":3001"
//     post_request(url, "getRawTransaction", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 //console.log("resp: ", resp)
//                 resp = normalize_string(resp)
//                 d.resolve( resp)
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             d.reject(error)
//         })
//
//      //TODO MISSING!!!! LOOKATME! INALL!!!
// }
//
// var decode_raw_transaction = function (tx, coin)
// {
//     var d = when.defer();
//     var tag = TAG+" | get_blockchain_info | "
//     coin = coin.toLowerCase()
//
//     var body = {
//         coin: coin,
//         tx: tx
//     }
//     //var url = servers[setting1[coin]]
//     var url = servers[coin]
//     url = url + ":3001"
//     post_request(url, "decodeRawTransaction", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 //console.log("resp: ", resp)
//
//                 d.resolve( resp)
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             d.reject(error)
//         })
//
//
// }
//
// var validate_address = function (address, coin)
// {
//     var d = when.defer();
//     var tag = TAG+" | get_blockchain_info | "
//     coin = coin.toLowerCase()
//
//     var body = {
//         coin: coin,
//         address: address
//     }
//     //var url = servers[setting1[coin]]
//     var url = servers[coin]
//     if (!url)
//     {
//         console.error("NO URL!!!  servers: ", servers)
//     }
//     url = url + ":3001"
//     post_request(url, "validateAddress", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 //console.log("resp: ", resp)
//                 if (typeof(resp) === "string")
//                 {
//                     resp = JSON.parse(resp)
//                 }
//                 d.resolve( resp)
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             d.reject(error)
//         })
//
//
// }
//
// var get_block_hash_from_height = function (height, coin)
// {
//     var d = when.defer();
//     var tag = TAG+" | get_blockchain_info | "
//     coin = coin.toLowerCase()
//
//     if (!height || !coin)
//     {
//         console.error(tag, "Empty Param!", height, coin)
//         d.reject("Empty Param!")
//     }
//
//     var body = {
//         coin: coin,
//         height: height
//     }
//     //var url = servers[setting1[coin]]
//     var url = servers[coin]
//     url = url + ":3001"
//     post_request(url, "getBlockHash", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 //console.log("resp: ", resp)
//                 resp = normalize_string(resp)
//                 d.resolve( resp)
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             d.reject(error)
//         })
//
//
// }
//
// var get_new_address = function (coin)
// {
//     var d = when.defer();
//     var tag = TAG+" | get_blockchain_info | "
//     coin = coin.toLowerCase()
//
//     var body = {
//         coin: coin
//     }
//     //var url = servers[setting1[coin]]
//     var url = servers[coin]
//     url = url + ":3001"
//     post_request(url, "getNewAddress", body)
//         .then(function (resp)
//         {
//             if (resp)
//             {
//                 //console.log("resp: ", resp)
//                 if(coin !== "nxt"){
//                     resp = normalize_string(resp)
//                 }
//                 d.resolve( resp)
//             } else
//             {
//                 d.reject("ERROR: empty response!")
//             }
//         })
//         .catch(function (error)
//         {
//             console.error("ShapeShift internal error! code:332")
//             d.reject(error)
//         })
//
//
// }
//
// //FRONT CANT DO THIS
// var send_to_address = function (coin, address, amount, param1)
// {
//
//     var tag = TAG+" | send_to_address | "
//
//     console.error("************************************************************")
//     console.error("POTENTIAL BREACH! ALERT! Front end attempted to steal money!")
//     console.error("************************************************************")
//
// }

// lib
let normalize_string = function (string) {
    //
    string = string.replace(new RegExp('"', 'g'), '')

    return string
}

var post_request = function (url, param, body) {
    let d = when.defer()
    let tag = TAG + ' | post_request | '
    let options = {
        method: 'POST',
        url: url + '/' + param,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        form: body
    }
    if (debug) console.log(tag, 'options: ', options)
    request(options, function (error, response, body) {
        if (error) {
            d.reject(error)
        }

        // console.log(tag,"body: ",body);
        // console.log(tag,"response: ",response);
        // console.log(tag,"body: ",body);
        // if(body.success){
        //     d.resolve(body)
        // } else {
        //     d.reject(body)
        // }

        d.resolve(body)
    })
    return d.promise
}
