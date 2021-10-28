module.exports = (function () {
    'use strict'

    // Module dependencies
    let crypto = require('crypto'),
        request = require('request'),
        nonce = require('nonce')()

    // Constants
    let version = '0.0.6',
        PUBLIC_API_URL = 'https://poloniex.com/public',
        PRIVATE_API_URL = 'https://poloniex.com/tradingApi',
        USER_AGENT = 'poloniex.js ' + version
        // USER_AGENT    = 'Mozilla/5.0 (Windows NT 6.3; WOW64; rv:26.0) Gecko/20100101 Firefox/26.0'

    // Helper methods
    function joinCurrencies (currencyA, currencyB) {
        // If only one arg, then return the first
        if (typeof currencyB !== 'string') {
            return currencyA
        }

        return currencyA + '_' + currencyB
    }

    function sortParameters (a, b) {
        return 0
        // Sort `nonce` parameter last, and the rest alphabetically
        return a === 'nonce' || a > b ? 1 : -1
    }

    // Constructor
    function Poloniex (key, secret) {
        // Generate headers signed by this user's key and secret.
        // The secret is encapsulated and never exposed
        this._getPrivateHeaders = function (parameters) {
            let paramString, signature

            if (!key || !secret) {
                throw 'Poloniex: Error. API key and secret required'
            }

            // Sort parameters alphabetically and convert to `arg1=foo&arg2=bar`
            paramString = Object.keys(parameters).sort(sortParameters).map(function (param) {
                return encodeURIComponent(param) + '=' + encodeURIComponent(parameters[param])
            }).join('&')

            signature = crypto.createHmac('sha512', secret).update(paramString).digest('hex')

            return {
                Key: key,
                Sign: signature
            }
        }
    }

    // Currently, this fails with `Error: CERT_UNTRUSTED`
    // Poloniex.STRICT_SSL can be set to `false` to avoid this. Use with caution.
    // Will be removed in future, once this is resolved.
    Poloniex.STRICT_SSL = true

    // Customisable user agent string
    Poloniex.USER_AGENT = USER_AGENT

    // Prototype
    Poloniex.prototype = {
        constructor: Poloniex,

        // Make an API request
        _request: function (options, callback) {
            if (!('headers' in options)) {
                options.headers = {}
            }

            options.json = true
            options.headers['User-Agent'] = Poloniex.USER_AGENT
            options.strictSSL = Poloniex.STRICT_SSL

            request(options, function (err, response, body) {
                // Empty response
                if (!err && (typeof body === 'undefined' || body === null)) {
                    err = 'Empty response'
                }

                if (callback) {
                    try {
                        callback(err, body)
                    } catch (e) {
                        console.error('Polo module~!2 : ', callback, err, body)
                    }
                } else {
                    console.error('Polo module~!1 : ', err, body)
                }
            })

            return this
        },

        // Make a public API request
        _public: function (command, parameters, callback) {
            let options

            if (typeof parameters === 'function') {
                callback = parameters
                parameters = {}
            }

            parameters || (parameters = {})
            parameters.command = command
            options = {
                method: 'GET',
                url: PUBLIC_API_URL,
                qs: parameters
            }

            options.qs.command = command
            return this._request(options, callback)
        },

        // Make a private API request
        _private: function (command, parameters, callback) {
            let options

            if (typeof parameters === 'function') {
                callback = parameters
                parameters = {}
            }

            parameters || (parameters = {})
            parameters.command = command
            parameters.nonce = nonce() * 1000

            options = {
                method: 'POST',
                url: PRIVATE_API_URL,
                form: parameters,
                headers: this._getPrivateHeaders(parameters)
            }
            // console.log(" | polo client | ","options: ",options)
            return this._request(options, callback)
        },

        /// //

        // PUBLIC METHODS

        getTicker: function (callback) {
            return this._public('returnTicker', callback)
        },

        get24hVolume: function (callback) {
            return this._public('return24hVolume', callback)
        },

        getOrderBook: function (currencyA, currencyB, callback) {
            let parameters = {
                currencyPair: joinCurrencies(currencyA, currencyB)
            }

            return this._public('returnOrderBook', parameters, callback)
        },

        getTradeHistory: function (pair, start, end, callback) {
            let parameters = {
                currencyPair: pair,
                start: start,
                end: end
            }

            return this._public('returnTradeHistory', parameters, callback)
        },

        /// //

        // PRIVATE METHODS

        myBalances: function (callback) {
            return this._private('returnBalances', callback)
        },

        getDepositAddresses: function (callback) {
            return this._private('returnDepositAddresses', callback)
        },

        getNewDepositAddress: function (currency, callback) {
            let parameters = {
                currency
            }

            return this._private('generateNewAddress', parameters, callback)
        },

        myOpenOrders: function (currencyA, currencyB, callback) {
            let parameters = {
                currencyPair: joinCurrencies(currencyA, currencyB)
            }

            return this._private('returnOpenOrders', parameters, callback)
        },

        myTradeHistory: function (parameters, callback) {
            // var parameters = {
            //         currencyPair: joinCurrencies(currencyA, currencyB)
            //     };

            return this._private('returnTradeHistory', parameters, ' ', callback)
        },

        buy: function (currencyA, currencyB, rate, amount, callback) {
            let parameters = {
                currencyPair: joinCurrencies(currencyA, currencyB),
                rate: rate,
                amount: amount
            }

            return this._private('buy', parameters, callback)
        },

        sell: function (currencyA, currencyB, rate, amount, callback) {
            let parameters = {
                currencyPair: joinCurrencies(currencyA, currencyB),
                rate: rate,
                amount: amount
            }

            return this._private('sell', parameters, callback)
        },

        cancelOrder: function (currencyA, currencyB, orderNumber, callback) {
            let parameters = {
                currencyPair: joinCurrencies(currencyA, currencyB),
                orderNumber: orderNumber
            }

            return this._private('cancelOrder', parameters, callback)
        },

        withdraw: function (currency, amount, address, callback) {
            let parameters = {
                currency: currency,
                amount: amount,
                address: address
            }

            return this._private('withdraw', parameters, callback)
        },

        history: function (start, end, callback) {
            let parameters = {
                // currency: currency,
                start,
                end
            }

            return this._private('returnDepositsWithdrawals', parameters, callback)
        }
    }

    return Poloniex
})()
