let when = require('when')
let request = require('request')
let prod = 'https://classic.shapeshift.com'
let cloud = 'https://classic.shapeshift.com'

module.exports = {
    coins: function (target) {
        return getCoins(target)
    }
}

const getCoins = function (target) {
    let d = when.defer()
    let url = prod + '/getcoins/'
    console.log("url: ",url)
    try{
        getRequest(url)
            .then(function (resp) {
                if (resp) {
                    console.log("resp: ",resp)
                    resp = JSON.parse(resp)
                    let coins = []
                    let offline = []

                    for (let property in resp) {
                        if (resp.hasOwnProperty(property)) {
                            if (resp[property].status === 'available') {
                                coins.push(resp[property].symbol)
                            } else {
                                offline.push(resp[property].symbol)
                            }
                        }
                    }

                    let report = {}
                    report.status = coins.length
                    report.online = coins
                    report.offline = offline

                    d.resolve(report)
                } else {
                    d.reject(false)
                }
        })
        .catch(function(e){
            console.error(e)
        })   
    }catch(e){
        console.error("****** e",e)
    }
    return d.promise
}


const getRequest = function (url) {
    let d = when.defer()
    try{
       request(url, function (error, response, body) {
            if (!error && response.statusCode === 200) {
                d.resolve(body)
           } else {
                console.error("Error: resp: ",error)
           }
        })
        return d.promise
    }catch(e){
        console.error("******** e:",e )
    }
}

getCoins('prod')
