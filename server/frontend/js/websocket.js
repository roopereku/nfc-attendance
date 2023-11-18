const protocol = location.protocol === "https:" ? "wss" : "ws"
const ws = new WebSocket(protocol + "://localhost:3000");

ws.addEventListener("open", (e) => {
	ws.send("Connected!");
});

ws.addEventListener("message", (e) => {
  console.log("Message from server ", e.data);
});
