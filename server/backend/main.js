const webSocket = require("websocket").server;
const bodyParser = require("body-parser")
const express = require("express")
const fs = require("fs")

const app = express()

let courses = {
	"ABCD1" : {
		name: "Test course 1"
	},

	"ABCD2" : {
		name: "Test course 2"
	}
}

function setUserState(courseId, userId, state)
{
	console.log("Set state", state, "for", userId, "in", courseId)
}

function validateCourse(req, res)
{
	if(req.params.courseId in courses)
	{
		return true
	}

	res.status(404)
	res.send("Invalid course")

	return false
}

app.use(express.static("/frontend"))
app.use(express.static("/backend/node_modules/bootstrap/dist/"))
app.use(bodyParser.json())

app.get("/", (req, res) => {
	res.sendFile("/frontend/html/index.html")
})

app.get("/dashboard", (req, res) => {
	res.sendFile("/frontend/html/dashboard.html")
})

app.post("/setUserState/:courseId", (req, res) => {
	// TODO: Make sure that whoever made the request is a permitted endpoint.
	if(validateCourse(req, res))
	{
		res.status(200)
	}
})

app.get("/view/:courseId", (req, res) => {
	if(validateCourse(req, res))
	{
		// TODO: Send ID as well.
		res.sendFile("/frontend/html/view.html")
	}
})

app.get("/courses", (req, res) => {
	res.send(JSON.stringify(courses))
})

const server = app.listen(3000, () => {
})

const ws = new webSocket({
	httpServer: server,
	autoAcceptConnections: false
})

ws.on("request", (req) => {
	// TODO: Handle origin.
	const connection = req.accept('', req.origin)
	console.log("New ws connection from", connection.remoteAddress)

	connection.on("message", (msg) => {
		console.log("Message from ws client", msg.utf8Data)
		connection.sendUTF(msg.utf8Data)
	})

	connection.on("close", (reason, description) => {
        console.log("Ws client", connection.remoteAddress, "disconnected");
	})
})
