const protocol = location.protocol === "https:" ? "wss" : "ws"
const ws = new WebSocket(protocol + "://" + location.hostname + websocketPath)

let pingInterval = undefined;

console.log("Websocket connecting to", protocol + "://" + location.hostname + websocketPath)

ws.addEventListener("open", (e) => {
	// Every 30 seconds, send an empty JSON body. This acts as a heartbeat
	// message because stale websocket connections die after some amount of time.
	pingInterval = setInterval(() => {
		ws.send("{}")
	}, 30000)
});

ws.addEventListener("close", (e) => {
	clearInterval(pingInterval)
})

ws.addEventListener("message", (e) => {
	console.log("Message from server ", e.data)
	onWebsocketMessage(JSON.parse(e.data))
});
