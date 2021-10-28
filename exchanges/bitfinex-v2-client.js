/*
        Bitfinex API v2 REST
                    - Highlander

 */
const exchangeName = 'bitfinex'
const TAG = ' | Bitfinexv2 | '
const config = require('../config')
const log = require('dumb-lumberjack')()

const BFX = require('bitfinex-api-node')

const bfx = new BFX({
    apiKey: config.EXCHANGES_CONFIG.Credentials.bitfinex.pub,
    apiSecret: config.EXCHANGES_CONFIG.Credentials.bitfinex.pri,

    ws: {
        autoReconnect: true,
        seqAudit: true,
        packetWDDelay: 10 * 1000
    }
})

const rest = bfx.rest(2, { transform: true })


//index
let magicNames =
    {
    ABS: 'The Abyss',
    ADD: 'ADD',
    AGI: 'SingularityNET',
    AID: 'AidCoin',
    AIO: 'Aion',
    ANT: 'Aragon',
    ATD: 'Atidium',
    ATM: 'Atonomi',
    AUC: 'Auctus',
    AVT: 'Aventus',
    BAB: 'Bitcoin ABC',
    BAT: 'Basic Attention Token',
    BBN: 'Banyan Network',
    BCH: 'Bitcoin Cash',
    BCI: 'BitcoinInterest',
    BFT: 'BnkToTheFuture',
    BNT: 'Bancor',
    BOX: 'ContentBox',
    BSV: 'Bitcoin SV',
    BTC: 'Bitcoin',
    BTG: 'Bitcoin Gold',
    BTT: 'BitTorrent',
    CBT: 'CommerceBlock',
    CFI: 'Cofound.it',
    CLO: 'Callisto',
    CND: 'Cindicator',
    CNN: 'Content Neutrality Network',
    CSX: 'Credits',
    CTX: 'Cortex',
    DAD: 'DADI',
    DAI: 'Dai Stablecoin',
    DAT: 'Streamr',
    DGB: 'Digibyte',
    DGX: 'Digix Gold Token',
    DRN: 'Dragonchain',
    DSH: 'Dash',
    DTA: 'Data',
    DTH: 'Dether',
    EDO: 'Eidoo',
    ELF: 'aelf',
    ENJ: 'Enjin',
    ESS: 'Essentia',
    ETC: 'Ethereum Classic',
    ETH: 'Ethereum',
    ETP: 'ETP',
    EUR: 'Euro',
    EVT: 'Ethfinex Voting Token',
    FSN: 'Fusion',
    FUN: 'FunFair',
    GBP: 'Pound Sterling',
    GNT: 'Golem',
    GOT: 'ParkinGO',
    GSD: 'GUSD',
    HOT: 'Hydro Protocol',
    IMP: 'Ether Kingdoms',
    INT: 'Internet Node Token',
    IOS: 'IOSToken',
    IOT: 'Iota',
    IQX: 'Everipedia',
    JPY: 'Japanese Yen',
    KNC: 'Kyber',
    LRC: 'Loopring',
    LTC: 'Litecoin',
    LYM: 'Lympo',
    MAN: 'Matrix',
    MGO: 'MobileGo',
    MIT: 'Mithril',
    MKR: 'Maker',
    MLN: 'Melon',
    MNA: 'Decentraland',
    MTN: 'Medicalchain',
    MTO: 'MEET.ONE',
    NCA: 'Nucleus Vision',
    NEC: 'Ethfinex Nectar Token',
    NEO: 'NEO',
    NIO: 'Autonio',
    ODE: 'Odem',
    OMG: 'OmiseGO',
    OMN: 'Omni',
    ONL: 'On.Live',
    ORS: 'ORS',
    PAI: 'PAI Project',
    PAS: 'Blockpass',
    PAX: 'Paxos',
    PNK: 'Kleros',
    POA: 'POA Network (erc20)',
    POY: 'Polymath',
    QSH: 'QASH',
    QTM: 'Qtum',
    RBT: 'RBTC',
    RCN: 'RCN',
    RDN: 'Raiden',
    REP: 'Augur',
    REQ: 'Request Network',
    RIF: 'RIF',
    RLC: 'iExec',
    RRT: 'Recovery Right Tokens',
    RTE: 'Rate3',
    SAN: 'Santiment',
    SEE: 'Seer',
    SEN: 'Consensus AI',
    SNG: 'SingularDTV',
    SNT: 'Status',
    SPK: 'SpankChain',
    STJ: 'Storj',
    TKN: 'TokenCard',
    TNB: 'Time New Bank',
    TRX: 'TRON',
    TSD: 'TrueUSD',
    UDC: 'USDc',
    USD: 'US Dollar',
    UTK: 'UTRUST',
    UTN: 'Universa',
    VEE: 'BLOCKv',
    VEN: 'VeChain',
    VET: 'VeChain',
    VLD: 'Vetri',
    VSY: 'V-SYSTEMS',
    WAX: 'WAX',
    WLO: 'WLO',
    WPR: 'WePower',
    WTC: 'Walton',
    XLM: 'Stellar Lumen',
    XMR: 'Monero',
    XRA: 'Xriba',
    XRP: 'Ripple',
    XTZ: 'Tezos',
    XVG: 'Verge',
    YGG: 'Yggdrash',
    YYW: 'YOYOW',
    ZCN: '0Chain',
    ZEC: 'Zcash',
    ZIL: 'Zilliqa',
    ZRX: '0x' }

//* ********************************
//         Module
//* ********************************

module.exports = {
    // async
    name: function () {
        return exchangeName
    },
    withdrawal: function (coin, amount, address) {
        return submit_withdrawal(coin, amount, address)
    },
    balances: function () {
        return get_balances()
    },
    // transferHistory: function (coin, start, end) {
    //     return get_transfer_history(coin, start, end)
    // },

    // withdrawalHistory: function (coin) {
    //     return get_withdrawal_history(coin)
    // },
    //
    // history: function (coin, start, end) {
    //     return get_history(coin, start, end)
    // },
    //
    // tradeHistory: function (coin, start, end) {
    //     return get_trade_history(coin, start, end)
    // },
    // tradeHistoryRip: function (start, end, interval) {
    //     return trade_history_rip(start, end, interval)
    // },
    //
    // transferHistoryRip: function (start, end, interval) {
    //     return transfer_history_rip(start, end, interval)
    // },
}

const get_balances = async function(){
    let tag = TAG + " | get_balances | "
    try{
        //
        let balances = await rest.balances()
        log.debug(tag,"balances: ",balances)

        const output = {}
        for (let j = 0; j < balances.length; j++) {
            let entry = balances[j]
            if (entry.type == 'deposit') output[entry.currency] = entry.amount
        }

        return output
    }catch(e){
        console.error(tag,e)
    }
}


const submit_withdrawal = async function(coin, amount, address){
    let tag = TAG + " | get_balances | "
    let output = {}
    output.success = false
    try{

        let trueName = magicNames[coin.toUpperCase()]
        if(!trueName) throw Error("Unable to find true name!")

        let resultWithdrawal = await rest.withdraw(trueName, 'exchange', amount, address)
        log.info(tag,"resultWithdrawal: ",resultWithdrawal)

        output.result = resultWithdrawal

        return output
    }catch(e){
        console.error(tag,e)
        output.error = e
        return output
    }
}



// const submit_withdrawal = async function (coin, amount, address) {
//     const tag = exchangeName + ' | submit_withdrawal | '
//     const d = when.defer()
//     const currency = coin.toUpperCase()
//     // console.log(tag,"currency: ",currency)
//     // console.log(tag,"amount: ",amount)
//     // console.log(tag,"address: ",address)
//     // withdraw_type, walletselected, amount, address, cb
//     let withdrawlCurrency
//     if (currency === 'BTC') withdrawlCurrency = 'bitcoin'
//     if (currency === 'LTC') withdrawlCurrency = 'litecoin'
//     if (currency === 'ETH') withdrawlCurrency = 'ethereum'
//     if (currency === 'ETC') withdrawlCurrency = 'ethereumc'
//     if (currency === 'USDT') withdrawlCurrency = 'tetheruse'
//     if (currency === 'XMR') withdrawlCurrency = 'monero'
//     if (currency === 'ZEC') withdrawlCurrency = 'zcash'
//     if (currency === 'DASH') withdrawlCurrency = 'dash'
//     if (currency === 'XRP') withdrawlCurrency = 'ripple'
//     if (currency === 'EOS') withdrawlCurrency = 'eos'
//     //if (currency === 'BCH') withdrawlCurrency = 'bcash'
//     if (currency === 'BCH') withdrawlCurrency = 'bab'
//     if (currency === 'OMG') withdrawlCurrency = 'omisego'
//     if (currency === 'NEO') withdrawlCurrency = 'neo'
//     if (currency === 'BTG') withdrawlCurrency = 'bgold'
//
//     // get max amount by coin
//     let maxSend = await redBack.get('rules:maxSend:bitfinex:' + currency)
//     if (maxSend) maxSend = parseInt(maxSend)
//     if (maxSend && maxSend < amount) amount = maxSend
//     amount = amount.toString()
//
//     let output = {}
//     output.success = false
//
//     if (withdrawlCurrency) {
//         client.withdraw(withdrawlCurrency, 'exchange', amount, address, function (err, resp) {
//             if (err) {
//                 console.error(tag, err, resp)
//                 output.error = err
//                 d.resolve(output)
//             } else {
//                 console.error(tag, 'Response: ', resp)
//                 if (typeof (resp) === 'string') resp = JSON.parse(resp)
//                 if (resp[0])resp = resp[0]
//                 if (resp.status === 'error') {
//                     output.error = resp.message
//                     d.resolve(output)
//                 } else {
//                     output.success = true
//                     output.msg = resp.message
//                     output.id = resp.withdrawal_id
//                     output.fees = resp.fees
//                     d.resolve(output)
//                 }
//             }
//         })
//     } else {
//         output.error = 'Unknown name for currency:' + currency
//         d.resolve(output)
//     }
//
//     return d.promise
// }