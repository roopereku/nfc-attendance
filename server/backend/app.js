const websocket = require("express-ws")
const express = require("express")
const cookieParser = require("cookie-parser")
const bodyParser = require("body-parser")
const crypto = require("crypto")
const db = require("./database")

const app = express()
const ws = websocket(app)

// List of active sessions. This information doesn't have to be stored in the
// database as it isn't persistent across multiple backend runs.
let activeSessions = {}

app.use(express.static("/frontend"))
app.use(express.static("/backend/node_modules/bootstrap/dist/"))

app.use(cookieParser()); 
app.use(bodyParser.json())
app.use((err, req, res, next) => {
	console.log("Got error", err)
	res.status(500)
});

module.exports.iterateWebsocketClients = (tag, callback) => {
	ws.getWss().clients.forEach((client) => {
		if(client.tag === tag)
		{
			callback(client)
		}
    });
}

module.exports.iterateCourseViewers = (courseId, callback) => {
	module.exports.iterateWebsocketClients("view", (client) => {
		if(client.viewedCourse === courseId)
		{
			callback(client)
		}
	})
}

module.exports.addRoute = (path, router) => {
	app.use(path, router)
}

module.exports.getUsername = (req) => {
	return activeSessions[req.cookies.sessionToken].username
}

module.exports.getExpress = () =>
{
	return app
}

module.exports.hasValidSessionToken = (req) => {
	if("sessionToken" in req.cookies)
	{
		return req.cookies.sessionToken in activeSessions
	}

	return false
}

module.exports.validateLogin = (req, res) => {
	if(module.exports.hasValidSessionToken(req))
	{
		return true
	}

	// There is no valid session token.
	res.redirect("/login")
	return false
}

app.get("/", (req, res) => {
	if(module.exports.validateLogin(req, res))
	{
		res.sendFile("/frontend/html/index.html")
	}
})

app.get("/getAvailableCourses", (req, res) => {
	if(module.exports.hasValidSessionToken(req))
	{
		db.query(
			"SELECT * FROM courses WHERE owner = $1",
			[ activeSessions[req.cookies.sessionToken].username ],
			(err, result) => {
				res.status(200)
				res.send(JSON.stringify(result.rows))
			}
		)
	}

	else
	{
		res.status(401)
		res.send("Invalid session token")
	}
})

app.post("/getSessionToken", (req, res) => {
	if(module.exports.hasValidSessionToken(req))
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
	if(module.exports.hasValidSessionToken(req))
	{
		res.redirect("/")
		return
	}

	// Show the login page.
	res.sendFile("/frontend/html/login.html")
})

module.exports.start = () => {
	app.listen(3000, () => {
		console.log("Express is up")
	});
}
