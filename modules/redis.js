/**
 * Created by highlander on 6/21/17.
 */
const config = require('../config')
const Redis = require('then-redis')

const redBack = Redis.createClient('tcp://' + config.REDBACK_HOST + ':' + config.REDBACK_PORT)

module.exports = redBack
