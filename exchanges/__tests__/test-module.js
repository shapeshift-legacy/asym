
// let client = require("../tagomi-client.js")


let run_test = async function(){
    try{
        await client.init()

        //get accounts
        // let result = await client.getAccounts()
        // console.log(result)

        //get wallets
        // let result = await client.getWallets()
        // console.log(result)

        //
        let currency = "XRP"
        let amount = 1
        let address = "rwfGzgd4bUStS9gA5xUhCmg1J86TMtmGMo"
        let result = await client.withdraw(currency,amount,address)
        console.log(result)
    }catch(e){
        console.error(e)
    }
}

run_test()
