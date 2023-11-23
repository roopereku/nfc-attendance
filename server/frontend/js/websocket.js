console.log("Websocket connecting to", location.hostname + websocketPath)

const protocol = location.protocol === "https:" ? "wss" : "ws"
const ws = new WebSocket(protocol + "://" + location.hostname + websocketPath)

ws.addEventListener("open", (e) => {
	ws.send("Connected!");
});

ws.addEventListener("message", (e) => {
  console.log("Message from server ", e.data)
});
