
let sscoins = require("../shapeshift")

sscoins.coins("prod")
    .then(function(resp){
        console.log(resp)
    })
