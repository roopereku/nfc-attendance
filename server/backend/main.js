const webSocket = require("websocket").server;
const cookieParser = require("cookie-parser")
const bodyParser = require("body-parser")
const express = require("express")
const crypto = require("crypto")
const fs = require("fs")

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

function validateCourse(id, res)
{
	if(id in courses)
	{
		return true
	}

	res.status(404)
	res.send("Invalid course")

	return false
}

function validateEndpointIdFormat(id, res)
{
	// TODO: Ensure that the supplied ID is something that the backend
	// would provide. For example make sure that the length is 16.

	return true
}

function validateEndpoint(req, res)
{
	// Make sure that the endpoint sent an ID.
	if("endpointId" in req.body)
	{
		// Ensure that the given ID is valid.
		if(validateEndpointIdFormat(req.body.endpointId, res))
		{
			// TODO: Ask the database if the given endpoint exists.
			// If no, respond with "401 Unauthorized".

			// TODO: Ask the database if the endpoint is blocked.
			// If yes, respond with "401 Unauthorized".

			return true
		}

		res.status(400)
		res.send("Invalid ID format")

		return false
	}

	res.status(400)
	res.send("Missing ID")

	return false
}

const app = express()

app.use(express.static("/frontend"))
app.use(express.static("/backend/node_modules/bootstrap/dist/"))

app.use(cookieParser()); 
app.use(bodyParser.json())
app.use(function(err, req, res, next) {
	console.log("Got error", err)
	res.status(500)
});

app.get("/", (req, res) => {
	res.sendFile("/frontend/html/index.html")
})

app.get("/dashboard", (req, res) => {
	res.sendFile("/frontend/html/dashboard.html")
})

app.post("/endpoint/register", (req, res) => {
	// Check if the endpoint supplied an existing ID.
	if("endpointId" in req.body)
	{
		// If an ID exists, make sure that endpoint is valid.
		if(validateEndpoint(req, res))
		{
			// TODO: Ask the database if the endpoint is already authorized.
			// If yes, respond with "200 OK" and send a list of available courses.

			// If the endpoint supplied an existing ID which isn' yet authorized or
			// blocked, respond with "201 Created" to indicate that the
			// endpoint is still waiting for authorization.
			res.status(201)
			res.send(JSON.stringify({
				endpointId: req.body.endpointId
			}))
		}
	}

	// TODO: Add the new endpoint into the database.
	const id = crypto.randomBytes(16).toString("hex")

	// Respond with "201 Created" to indicate that the
	// endpoint is still waiting for authorization.
	res.status(201)
	res.send(JSON.stringify({
		endpointId: id
	}))
})

app.post("/endpoint/join/", (req, res) => {
	if(validateEndpoint(req, res))
	{
	}
})

app.post("/endpoint/setUserState/", (req, res) => {
	if(validateEndpoint(req, res))
	{
		console.log(req.body)
		res.status(200)
		res.send(JSON.stringify({
			userName: "Test user"
		}))
	}
})

app.get("/view/:courseId", (req, res) => {
	if(validateCourse(req.params.courseId, res))
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
