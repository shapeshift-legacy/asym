const when = require('when')
const config = require('../config')
const redBack = require('../modules/redis.js')

const pause = function (length) {
    const d = when.defer()
    const done = function () { d.resolve(true) }
    setTimeout(done, length * 1000)
    return d.promise
}

let run = async function () {
    try {
        //
        // let result = await redBack.scan("match","[a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z]")

        for (let i = 0; i < 10000; i++) {
            let result = await redBack.send('scan', [ i, 'MATCH', '[a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z]' ])
            // redBack.send('scan', [ 'MATCH', '[a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z][a-z,A-Z]', 'b', 'two' ])
            console.log(result)

            let key = result[1][0]
            if (key && key.length > 0) {
                console.log('key', key)
                let delResult = await redBack.del(key)
                console.log('del: ', delResult)
            }
            await pause(1)
        }
    } catch (e) {
        console.error('e: ', e)
    }
}

run()
