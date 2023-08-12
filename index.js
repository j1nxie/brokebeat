const express = require("express");
const app = express();
const expressWs = require("express-ws")(app);

app.listen(5732, () => {
    console.log("application started and listening on port 5732");
})

app.use(express.static(__dirname + "/src/www/"));

app.get("/", (_, res) => {
    res.sendFile(__dirname + "/src/www/app.html");
})

app.ws("/ws", (_, req) => {
    ws.on("message", (msg) => {
        if (msg === "alive?") {
            ws.send("alive");
        }

        if (msg[0] === "b") {
            // process key
            // send key according to keycode
            // https://github.com/node-ffi-napi/node-ffi-napi is a viable solution
        }
    })
})