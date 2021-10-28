/**
 * Created by highlander on 9/6/17.
 */
const monk = require('monk')
const config = require('../config')
const db = monk(config.MONGO_URI)
