





let TAG = " | reports | "
module.exports = {
    //read all pending
    reportByDays: function (action)
    {
        return perform_balance_action(action);
    },
}






const perform_balance_action = async function(action) {
    const tag = TAG+" | perform_balance_actions_auto | "
    const debug = false
    const debug1 = false
    try {


        if(debug) console.log(tag,"action: ",action)
        const actionId = action
        if(debug) console.log(tag,"actionId: ",actionId)

        const actionInfo = await redBack.hget("balanceActions",action)

        const result = await execute_action_auto(actionInfo)

        //save to report
        const actionString = actionInfo.split(" ")
        const coin        = actionString[0]
        const amount      = actionString[1]
        const source      = actionString[2]
        const destination = actionString[3]

        if(source == "hot"){
            //if failed add to broken paths
            if(!result.txid || result.txid == "" || result.txid.length < 3){
                //Failed to send
                output["result"+i] = ":stop: :"+coin+":  *"+amount.toLocaleString()+"* :"+source+":  :arrow_forward:   :"+destination+":  "+JSON.stringify(result)
                alert.channel(" :"+coin+": is broke! Trying again later! Error: "+JSON.stringify(result),"alerts")
                redBack.sadd("brokenPaths",coin+"_"+source+"_"+destination)
            } else {
                output["result"+i] = ":success: :"+coin+":  *"+amount.toLocaleString()+"* :"+source+":  :arrow_forward:   :"+destination+":  "+JSON.stringify(result)

                //display to balancing
                views.displayStringToChannel(":success: :"+coin+":  *"+amount.toLocaleString()+"* :"+source+":  :arrow_forward:   :"+destination+":  "+JSON.stringify(result),"balancing-events")
                redBack.srem("brokenPaths",coin+"_"+source+"_"+destination)
            }
        } else {
            output["result"+i] = ":success: :"+coin+":  *"+amount.toLocaleString()+"* :"+source+":  :arrow_forward:   :"+destination+":  "+JSON.stringify(result)
            views.displayStringToChannel(":success: :"+coin+":  *"+amount.toLocaleString()+"* :"+source+":  :arrow_forward:   :"+destination+":  "+JSON.stringify(result),"balancing-events")
        }


        let verboseInfo = await redBack.get(actionId)
        if(debug) console.log(tag,"verboseInfo: ",verboseInfo)

        if(verboseInfo) verboseInfo = JSON.parse(verboseInfo)
        //irregularity
        const irregularity = verboseInfo.irregularity.summary

        //balanceSource before
        const balanceSourceBefore = verboseInfo.coinBalance[source]
        //balanceSource before
        const balanceDestinationBefore = verboseInfo.coinBalance[destination]

        //balanceDestination after
        const balanceSourceAfter = verboseInfo.balancesAfter[source]
        //balanceDestination after
        const balanceDestinationAfter = verboseInfo.balancesAfter[destination]

        //percent targets
        const rules = await redBack.hgetall("rules:percentage:"+coin)
        const percentTargetSource = rules[source]
        const percentTargetDestination = rules[destination]

        //totals
        // const percentagesByCoin = await percentages_by_coin()
        // const totalOwned = percentagesByCoin[coin].total
        //const currentPercentageSource = percentagesByCoin[coin][source]

        const element = {
            actionId,
            coin,
            amount,
            source,
            destination,
            irregularity,
            //totalOwned,
            balanceSourceBefore,
            balanceDestinationBefore,
            balanceSourceAfter,
            balanceDestinationAfter,
            percentTargetSource,
            percentTargetDestination,
            txid:JSON.stringify(result)
        }

        element.time = new Date().getTime()
        element.date = new Date()
        reportsH.insert(element)


    }catch(e){
        console.error(tag,"ERROR:",e)
    }
}