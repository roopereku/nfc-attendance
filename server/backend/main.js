const cookieParser = require("cookie-parser")
const bodyParser = require("body-parser")
const websocket = require("express-ws")
const express = require("express")
const crypto = require("crypto")
const fs = require("fs")

// List of active sessions. This information doesn't have to be stored in the
// database as it isn't persistent across multiple backend runs.
let activeSessions = {}

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

function hasValidSessionToken(req)
{
	if("sessionToken" in req.cookies)
	{
		return req.cookies.sessionToken in activeSessions
	}

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

function validateLogin(req, res)
{
	if(hasValidSessionToken(req))
	{
		return true
	}

	// There is no valid session token.
	res.redirect("/login")
	return false
}

function iterateWebsocketClients(tag, callback)
{
	ws.getWss().clients.forEach((client) => {
		if(client.tag === tag)
		{
			callback(client)
		}
    });
}

function displayNewEndpoint(id)
{
	iterateWebsocketClients("dashboard", (client) => {
		client.send(JSON.stringify({
			status: "newEndpoint",
			endpointId: id
		}))
	})
}

function displayProcessedEndpoint(id)
{
	iterateWebsocketClients("dashboard", (client) => {
		client.send(JSON.stringify({
			status: "processedEndpoint",
			endpointId: id
		}))
	})
}

function displayAllWaitingEndpoints()
{
	iterateWebsocketClients("dashboard", (client) => {
	})
}

const app = express()
const ws = websocket(app)

// TODO: Serve files from Nginx?
app.use(express.static("/frontend"))
app.use(express.static("/backend/node_modules/bootstrap/dist/"))

app.use(cookieParser()); 
app.use(bodyParser.json())
app.use(function(err, req, res, next) {
	console.log("Got error", err)
	res.status(500)
});

app.get("/", (req, res) => {
	if(validateLogin(req, res))
	{
		res.sendFile("/frontend/html/index.html")
	}
})

app.post("/getSessionToken", (req, res) => {
	if(hasValidSessionToken(req))
	{
		res.status(400)
		res.send("Session token already exists")
		return
	}

	if("username" in req.body && "password" in req.body)
	{
		// TODO: Store these in a database.
		const defaultAdminUsername = "admin"
		const defaultAdminPassword = "pass"

		if(req.body.username === defaultAdminUsername)
		{
			// TODO: Hash the password and look for a match from the database.
			const hashedDefault = crypto.createHash('md5').update(defaultAdminPassword).digest('hex');
			const hashedPassword = crypto.createHash('md5').update(req.body.password).digest('hex');

			if(hashedDefault === hashedPassword)
			{
				const token = crypto.randomBytes(16).toString("hex")

				// TODO: Make sure that the new token doesn't already exist.
				activeSessions[token] = {
					// TODO: Store client IP?
					username: req.body.username
				}

				console.log("User", req.body.username, "logged in with token", token)

				res.cookie("sessionToken", token, {
					sameSite: "strict",
					httpOnly: true
				})

				res.status(200)
				res.send("Set token")

				return
			}
		}

		res.status(401)
		res.send("Invalid credentials")
	}

	else
	{
		res.status(400)
		res.send("Missing fields")
	}
})

app.get("/login", (req, res) => {
	// If the user is already logged in, go to the main page
	if(hasValidSessionToken(req))
	{
		res.redirect("/")
		return
	}

	// Show the login page.
	res.sendFile("/frontend/html/login.html")
})

app.get("/dashboard", (req, res) => {
	if(validateLogin(req, res))
	{
		res.sendFile("/frontend/html/dashboard.html")
	}
})

app.ws("/dashboard", (client, req) => {
	// If no session token was provided, don't accept the connection.
	if(!hasValidSessionToken(req))
	{
		console.log("Reject connection because it has no session token")
		return
	}

	client.tag = "dashboard"

	client.on("message", (msg) => {
		try
		{
			console.log(msg)
			cmd = JSON.parse(msg)

			// TODO: Validate endpoint ID with validateEndpoint

			if(cmd.status == "authorizeEndpoint")
			{
				// TODO: Set the status of the given endpoint to authorized.
				displayProcessedEndpoint(cmd.endpointId)
			}

			else if(cmd.status == "blockEndpoint")
			{
				// TODO: Set the status of the given endpoint to blocked.
				displayProcessedEndpoint(cmd.endpointId)
			}
		}

		catch(err)
		{
			console.log("Error while parsing JSON sent by a dashboard user:", err)
		}
	})
})

app.get("/view/:courseId", (req, res) => {
	if(validateLogin(req, res))
	{
		res.cookie("courseId", req.params.courseId, { sameSite: "Strict" })
		res.sendFile("/frontend/html/view.html")
	}
})

app.ws("/view/:courseId", (client, req) => {
	// If no session token was provided, don't accept the connection.
	if(!hasValidSessionToken(req))
	{
		console.log("Reject connection because it has no session token")
		return
	}

	client.tag = "view"
})

app.get("/courses", (req, res) => {
	res.send(JSON.stringify(courses))
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

		return
	}

	// TODO: Add the new endpoint into the database.
	const id = crypto.randomBytes(16).toString("hex")

	// Respond with "201 Created" to indicate that the
	// endpoint is still waiting for authorization.
	res.status(201)
	res.send(JSON.stringify({
		endpointId: id
	}))

	// Display the newly created endpoint on every active dashboard.
	displayNewEndpoint(id)
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

app.listen(3000, () => {
})
