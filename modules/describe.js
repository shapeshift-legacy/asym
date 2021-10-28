/**
 * Created by highlander on 5/27/17.
 */
/**
 * Created by highlander on 5/27/17.
 */

//

module.exports = {

    map: function (module) {
        return map_module(module)
    },
    // object
    // api
    // memory
}

/***************************
 // Primary
 //****************************/

/***************************
 // LIB
 //****************************/

// parse module and return map
const map_module = function (module) {
    const tag = ' | map_module | '
    const map = {}

    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg
    const ARGUMENT_NAMES = /([^\s,]+)/g
    function getParamNames (func) {
        const fnStr = func.toString().replace(STRIP_COMMENTS, '')
        let result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES)
        if (result === null) { result = [] }
        return result
    }

    Object.keys(module).forEach(function (key) {
        const val = module[key]
        const params = getParamNames(val)
        map[key] = params
    })

    return map
}
