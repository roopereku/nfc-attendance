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

function isValidSessionToken(token)
{
	// TODO: Ask the database if the given token is valid.
	return true
}

function hasValidSessionToken(req)
{
	if(Array.isArray(req.cookies))
	{
		for(const i in req.cookies)
		{
			if(req.cookies[i].name === "sessionToken")
			{
				return isValidSessionToken(req.cookies[i].value)
			}
		}
	}

	if("sessionToken" in req.cookies)
	{
		return isValidSessionToken(req.cookies.sessionToken)
	}

	return false
}

function validateLogin(req, res)
{
	if(hasValidSessionToken(req))
	{
		// TODO: Validate session token.

		return true
	}

	// There is no valid session token.
	res.redirect("/login")
	return false
}

const app = express()

// TODO: Only expose /frontend/js.
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

app.get("/view/:courseId", (req, res) => {
	if(validateLogin(req, res))
	{
		if(validateCourse(req.params.courseId, res))
		{
			// TODO: Send ID as well.
			res.sendFile("/frontend/html/view.html")
		}
	}
})

app.get("/courses", (req, res) => {
	res.send(JSON.stringify(courses))
})

app.post("/endpoint/register", (req, res) => {
	// TODO: Add the new endpoint into the database.
	const id = crypto.randomBytes(16).toString("hex")

	res.status(200)
	res.send(JSON.stringify({
		endpointId: id
	}))
})

app.post("/endpoint/setUserState/", (req, res) => {
	// TODO: Make sure that whoever made the request is a permitted endpoint.
	console.log(req.body)
	res.status(200)
	res.send(JSON.stringify({
		userName: "Test user"
	}))
})

const server = app.listen(3000, () => {
})

const ws = new webSocket({
	httpServer: server,
	autoAcceptConnections: false
})

ws.on("request", (req) => {
	// TODO: Handle origin.

	// If no session token was provided, don't accept the connection.
	if(!hasValidSessionToken(req))
	{
		console.log("Reject connection because it has no session token")
		return
	}

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
