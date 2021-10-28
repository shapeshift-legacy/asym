// Generated by CoffeeScript 1.8.0
(function () {
    let Bitfinex, crypto, qs, request

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

    request = require('request')

    crypto = require('crypto')

    qs = require('querystring')

    module.exports = Bitfinex = (function () {
        function Bitfinex (key, secret) {
            this.url = 'https://api.bitfinex.com'
            this.version = 'v1'
            this.key = key
            this.secret = secret
            this.nonce = Math.ceil((new Date()).getTime() / 1000)
        }

        Bitfinex.prototype._nonce = function () {
            return ++this.nonce
        }

        Bitfinex.prototype.make_request = function (sub_path, params, cb) {
            let headers, key, nonce, path, payload, signature, url, value
            if (!this.key || !this.secret) {
                return cb(new Error('missing api key or secret'))
            }
            path = '/' + this.version + '/' + sub_path
            url = this.url + path
            nonce = JSON.stringify(this._nonce())
            payload = {
                request: path,
                nonce: nonce
            }
            for (key in params) {
                value = params[key]
                payload[key] = value
            }
            payload = new Buffer(JSON.stringify(payload)).toString('base64')
            signature = crypto.createHmac('sha384', this.secret).update(payload).digest('hex')
            headers = {
                'X-BFX-APIKEY': this.key,
                'X-BFX-PAYLOAD': payload,
                'X-BFX-SIGNATURE': signature
            }
            return request({
                url: url,
                method: 'POST',
                headers: headers,
                timeout: 15000
            }, function (err, response, body) {
                let error, result
                if (err || (response.statusCode !== 200 && response.statusCode !== 400)) {
                    return cb(new Error(err != null ? err : response.statusCode))
                }
                try {
                    result = JSON.parse(body)
                } catch (_error) {
                    error = _error
                    return cb(null, {
                        messsage: body.toString()
                    })
                }
                if (result.message != null) {
                    return cb(new Error(result.message))
                }
                return cb(null, result)
            })
        }

        Bitfinex.prototype.make_public_request = function (path, cb) {
            let url
            url = this.url + '/v1/' + path
            return request({
                url: url,
                method: 'GET',
                timeout: 15000
            }, function (err, response, body) {
                let error, result
                if (err || (response.statusCode !== 200 && response.statusCode !== 400)) {
                    return cb(new Error(err != null ? err : response.statusCode))
                }
                try {
                    result = JSON.parse(body)
                } catch (_error) {
                    error = _error
                    return cb(null, {
                        messsage: body.toString()
                    })
                }
                if (result.message != null) {
                    return cb(new Error(result.message))
                }
                return cb(null, result)
            })
        }

        Bitfinex.prototype.ticker = function (symbol, cb) {
            return this.make_public_request('pubticker/' + symbol, cb)
        }

        Bitfinex.prototype.today = function (symbol, cb) {
            return this.make_public_request('today/' + symbol, cb)
        }

        Bitfinex.prototype.candles = function (symbol, cb) {
            return this.make_public_request('candles/' + symbol, cb)
        }

        Bitfinex.prototype.lendbook = function (currency, cb) {
            return this.make_public_request('lendbook/' + currency, cb)
        }

        Bitfinex.prototype.orderbook = function (symbol, options, cb) {
            let err, index, option, query_string, uri, value
            index = 0
            uri = 'book/' + symbol
            if (typeof options === 'function') {
                cb = options
            } else {
                try {
                    for (option in options) {
                        value = options[option]
                        if (index++ > 0) {
                            query_string += '&' + option + '=' + value
                        } else {
                            query_string = '/?' + option + '=' + value
                        }
                    }
                    if (index > 0) {
                        uri += query_string
                    }
                } catch (_error) {
                    err = _error
                    return cb(err)
                }
            }
            return this.make_public_request(uri, cb)
        }

        Bitfinex.prototype.trades = function (symbol, cb) {
            return this.make_public_request('trades/' + symbol, cb)
        }

        Bitfinex.prototype.lends = function (currency, cb) {
            return this.make_public_request('lends/' + currency, cb)
        }

        Bitfinex.prototype.get_symbols = function (cb) {
            return this.make_public_request('symbols', cb)
        }

        Bitfinex.prototype.symbols_details = function (cb) {
            return this.make_public_request('symbols_details', cb)
        }

        Bitfinex.prototype.new_order = function (symbol, amount, price, exchange, side, type, is_hidden, cb) {
            let params
            if (typeof is_hidden === 'function') {
                cb = is_hidden
                is_hidden = false
            }
            params = {
                symbol: symbol,
                amount: amount,
                price: price,
                exchange: exchange,
                side: side,
                type: type
            }
            if (is_hidden) {
                params['is_hidden'] = true
            }
            return this.make_request('order/new', params, cb)
        }

        Bitfinex.prototype.multiple_new_orders = function (symbol, amount, price, exchange, side, type, cb) {
            let params
            params = {
                symbol: symbol,
                amount: amount,
                price: price,
                exchange: exchange,
                side: side,
                type: type
            }
            return this.make_request('order/new/multi', params, cb)
        }

        Bitfinex.prototype.cancel_order = function (order_id, cb) {
            let params
            params = {
                order_id: parseInt(order_id)
            }
            return this.make_request('order/cancel', params, cb)
        }

        Bitfinex.prototype.cancel_all_orders = function (cb) {
            return this.make_request('order/cancel/all', {}, cb)
        }

        Bitfinex.prototype.cancel_multiple_orders = function (order_ids, cb) {
            let params
            params = {
                order_ids: order_ids.map(function (id) {
                    return parseInt(id)
                })
            }
            return this.make_request('order/cancel/multi', params, cb)
        }

        Bitfinex.prototype.replace_order = function (order_id, symbol, amount, price, exchange, side, type, cb) {
            let params
            params = {
                order_id: parseInt(order_id),
                symbol: symbol,
                amount: amount,
                price: price,
                exchange: exchange,
                side: side,
                type: type
            }
            return this.make_request('order/cancel/replace', params, cb)
        }

        Bitfinex.prototype.order_status = function (order_id, cb) {
            let params
            params = {
                order_id: order_id
            }
            return this.make_request('order/status', params, cb)
        }

        Bitfinex.prototype.active_orders = function (cb) {
            return this.make_request('orders', {}, cb)
        }

        Bitfinex.prototype.active_positions = function (cb) {
            return this.make_request('positions', {}, cb)
        }

        Bitfinex.prototype.movementsByTime = function (currency, start, stop, cb) {
            let err, option, params, value
            params = {
                currency: currency,
                since: start,
                until: stop,
            }

            return this.make_request('history/movements', params, cb)
        }

        Bitfinex.prototype.movements = function (currency, options, cb) {
            let err, option, params, value
            params = {
                currency: currency
            }
            if (typeof options === 'function') {
                cb = options
            } else {
                try {
                    for (option in options) {
                        value = options[option]
                        params[option] = value
                    }
                } catch (_error) {
                    err = _error
                    return cb(err)
                }
            }
            return this.make_request('history/movements', params, cb)
        }

        Bitfinex.prototype.tradesByTime = function (currency, start, stop, cb) {
            let err, option, params, value
            params = {
                symbol: currency,
                since: start,
                until: stop,
                limit_trades: 50,
            }

            return this.make_request('mytrades', params, cb)
        }

        Bitfinex.prototype.past_trades = function (symbol, options, cb) {
            let err, option, params, value
            params = {
                symbol: symbol
            }
            if (typeof options === 'function') {
                cb = options
            } else {
                try {
                    for (option in options) {
                        value = options[option]
                        params[option] = value
                    }
                } catch (_error) {
                    err = _error
                    return cb(err)
                }
            }
            return this.make_request('mytrades', params, cb)
        }

        Bitfinex.prototype.new_deposit = function (currency, method, wallet_name, cb) {
            let params
            params = {
                currency: currency,
                method: method,
                wallet_name: wallet_name
            }
            return this.make_request('deposit/new', params, cb)
        }

        Bitfinex.prototype.new_offer = function (currency, amount, rate, period, direction, insurance_option, cb) {
            let params
            params = {
                currency: currency,
                amount: amount,
                rate: rate,
                period: period,
                direction: direction,
                insurance_option: insurance_option
            }
            return this.make_request('offer/new', params, cb)
        }

        Bitfinex.prototype.cancel_offer = function (offer_id, cb) {
            let params
            params = {
                offer_id: offer_id
            }
            return this.make_request('offer/cancel', params, cb)
        }

        Bitfinex.prototype.offer_status = function (order_id, cb) {
            let params
            params = {
                order_id: order_id
            }
            return this.make_request('offer/status', params, cb)
        }

        Bitfinex.prototype.active_offers = function (cb) {
            return this.make_request('offers', {}, cb)
        }

        Bitfinex.prototype.active_credits = function (cb) {
            return this.make_request('credits', {}, cb)
        }

        Bitfinex.prototype.wallet_balances = function (cb) {
            return this.make_request('balances', {}, cb)
        }

        Bitfinex.prototype.taken_swaps = function (cb) {
            return this.make_request('taken_swaps', {}, cb)
        }

        Bitfinex.prototype.close_swap = function (swap_id, cb) {
            return this.make_request('swap/close', {
                swap_id: swap_id
            }, cb)
        }

        Bitfinex.prototype.account_infos = function (cb) {
            return this.make_request('account_infos', {}, cb)
        }

        Bitfinex.prototype.margin_infos = function (cb) {
            return this.make_request('margin_infos', {}, cb)
        }

        /*
    		POST /v1/withdraw

    		Parameters:
    		'withdraw_type' :string (can be "bitcoin", "litecoin" or "darkcoin" or "mastercoin")
    		'walletselected' :string (the origin of the wallet to withdraw from, can be "trading", "exchange", or "deposit")
    		'amount' :decimal (amount to withdraw)
    		'address' :address (destination address for withdrawal)
     */

        Bitfinex.prototype.withdraw = function (withdraw_type, walletselected, amount, address, cb) {
            let params
            params = {
                withdraw_type: withdraw_type,
                walletselected: walletselected,
                amount: amount,
                address: address
            }
            return this.make_request('withdraw', params, cb)
        }

        /*
    		POST /v1/transfer

    		Parameters:
    		‘amount’: decimal (amount to transfer)
    		‘currency’: string, currency of funds to transfer
    		‘walletfrom’: string. Wallet to transfer from
    		‘walletto’: string. Wallet to transfer to
     */

        Bitfinex.prototype.transfer = function (amount, currency, walletfrom, walletto, cb) {
            let params
            params = {
                amount: amount,
                currency: currency,
                walletfrom: walletfrom,
                walletto: walletto
            }
            return this.make_request('transfer', params, cb)
        }

        return Bitfinex
    })()
}).call(this)
