const websocketPath = "/dashboard/"

function onWebsocketMessage(msg)
{
	console.log("Got status", msg.status)
}
