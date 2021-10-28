function readConfig() {
    let config = {}

    try {
        // load the decrypted config file, default to local config
        const environment = process.env.ENVIRONMENT || 'local'
        const filePath = `./config/${environment}.json`

        config = require(filePath)
        console.log(`Successfully loaded json file: config/${environment}.json`)

    } catch (e) {
        throw new Error(`Couldn't read json file: ${e}`)
    }

    return config
}

module.exports = readConfig()