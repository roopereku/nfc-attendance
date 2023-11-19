const ws = new WebSocket("wss://" + location.hostname);

ws.addEventListener("open", (e) => {
	ws.send("Connected!");
});

ws.addEventListener("message", (e) => {
  console.log("Message from server ", e.data);
});
