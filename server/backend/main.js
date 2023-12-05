const cookieParser = require("cookie-parser")
const bodyParser = require("body-parser")
const websocket = require("express-ws")
const express = require("express")
const crypto = require("crypto")
const postgres = require("pg")
const fs = require("fs")

// List of active sessions. This information doesn't have to be stored in the
// database as it isn't persistent across multiple backend runs.
let activeSessions = {}

function validateCourse(id, res, callback)
{
	db.query(
		"SELECT id FROM courses WHERE id = $1",
		[ id ], (err, result) => {
			if(result.rows.length === 0)
			{
				res.status(403)
				res.send("Invalid course ID")
			}

			else
			{
				callback(err, result)
			}
		}
	)
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

function validateEndpointAuthorized(req, res, callback)
{
	// Make sure that the endpoint sent an ID.
	if("endpointId" in req.body)
	{
		// Ensure that the given ID is valid.
		if(validateEndpointIdFormat(req.body.endpointId, res))
		{
			getEndpoint(req.body.endpointId, (result) => {
				// If no rows were returned, there is no such endpoint.
				if(result === undefined || result.rows.length === 0)
				{
					res.status(401)
					res.send("Invalid endpoint ID")
				}

				else
				{
					console.log(result.rows)
					const endpointStatus = result.rows[0].status
					const endpointId = result.rows[0].id

					// Is the endpoint blocked by an admin.
					if(endpointStatus=== "blocked")
					{
						console.log("Endpoint", endpointId, "is blocked")

						res.status(401)
						res.send("Endpoint is blocked")
					}

					// If the endpoint supplied an existing ID which isn' yet authorized or
					// blocked, respond with "201 Created" to indicate that the
					// endpoint is still waiting for authorization.
					else if(endpointStatus === "waiting")
					{
						console.log("Endpoint", endpointId, "is waiting")

						res.status(201)
						res.send(JSON.stringify({
							endpointId: endpointId
						}))
					}

					// Call the callback if the endpoint is authorized.
					else if(endpointStatus === "authorized")
					{
						console.log("Endpoint", endpointId, "is authorized")
						callback(result)
					}

					else
					{
						console.log("Weird status for", endpointId, endpointStatus)
					}
				}
			})
		}
	}

	else
	{
		res.status(400)
		res.send("Missing ID")
	}
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

function iterateCourseViewers(courseId, callback)
{
	iterateWebsocketClients("view", (client) => {
		if(client.viewedCourse === courseId)
		{
			callback(client)
		}
	})
}

function displayCourseMembers(courseId, callback)
{
	// Find all members that are part of the requested course.
	db.query(
		"SELECT members FROM courses WHERE id = $1",
		[ courseId ], (err, result) => {

			// Is there anything to show?
			if(result.rows.length !== 0)
			{
				// Find information about the course members.
				db.query(
					"SELECT name, id, currentcourse FROM members WHERE id = ANY($1)",
					[ result.rows[0].members ], (err, result) => {
						result.rows.sort((a,b) => a.name - b.name)

						// Don't expose the current course of any member.
						result.rows.forEach((row) => {
							row.isPresent = row.currentcourse === courseId
							row.currentcourse
						})

						const json = JSON.stringify({
							status: "memberSync",
							members: result.rows
						})

						callback(json)
					}
				)
			}
		}
	)
}

function displayMembers(callback)
{
	db.query(
		"SELECT name, id FROM members",
		(err, result) => {
			result.rows.sort((a,b) => a.name - b.name)

			const json = JSON.stringify({
				status: "memberSync",
				members: result.rows
			})

			callback(json)
		}
	)
}

function displayEndpoints(callback)
{
	db.query(
		"SELECT id, status FROM endpoints",
		(err, result) => {
			const json = JSON.stringify({
				status: "endpointSync",
				endpoints: result.rows
			})

			callback(json)
		}
	)
}

function getEndpoint(id, callback)
{
	const result = db.query(
		"SELECT id, status FROM endpoints WHERE id = $1",
		[ id ], (err, result) => {
			callback(result)
		}
	)
}

const app = express()
const ws = websocket(app)

const db = new postgres.Client({
	user: "nfcuser",
	password: "nfcpass",
	host: "postgres",
	database: "nfcattendance",
	port: 5432,
})

// TODO: Serve files from Nginx?
app.use(express.static("/frontend"))
app.use(express.static("/backend/node_modules/bootstrap/dist/"))

app.use(cookieParser()); 
app.use(bodyParser.json())
app.use((err, req, res, next) => {
	console.log("Got error", err)
	res.status(500)
});

app.get("/", (req, res) => {
	if(validateLogin(req, res))
	{
		res.sendFile("/frontend/html/index.html")
	}
})

app.get("/getAvailableCourses", (req, res) => {
	if(hasValidSessionToken(req))
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
	client.username = activeSessions[req.cookies.sessionToken].username

	displayMembers((json) => {
		iterateWebsocketClients("dashboard", (client) => {
			client.send(json)
		})
	})

	displayEndpoints((json) => {
		iterateWebsocketClients("dashboard", (client) => {
			client.send(json)
		})
	})

	db.query(
		"SELECT * FROM courses WHERE owner = $1",
		[ activeSessions[req.cookies.sessionToken].username ], (err, result) => {
			let courses = []
			result.rows.forEach((row) => {
				courses.push({
					courseId: row.id,
					courseName: row.name,
					courseMembers: row.members,
					courseEndpoints: row.endpoints
				})
			})

			client.send(JSON.stringify({
				status: "courseSync",
				courses: courses
			}))
		}
	)

	client.on("message", (msg) => {
		try
		{
			console.log(msg)
			cmd = JSON.parse(msg)
		}

		catch(err)
		{
			console.log("Error while parsing JSON sent by a dashboard user:", err)
		}

		if(cmd.status == "authorizeEndpoint")
		{
			db.query(
				"UPDATE endpoints SET status = $1 WHERE id = $2",
				[ "authorized", cmd.endpointId ], (err, result) => {
					displayEndpoints((json) => {
						iterateWebsocketClients("dashboard", (client) => {
							client.send(json)
						})
					})
				}
			)
		}

		else if(cmd.status == "blockEndpoint")
		{
			db.query(
				"UPDATE endpoints SET status = $1 WHERE id = $2",
				[ "blocked", cmd.endpointId ], (err, result) => {
					displayEndpoints((json) => {
						iterateWebsocketClients("dashboard", (client) => {
							client.send(json)
						})
					})
				}
			)
		}

		else if(cmd.status == "submitCourse")
		{
			fieldResponse = {}

			// Ensure that "members" is an array.
			if(!Array.isArray(cmd.courseMembers))
			{
				fieldResponse.courseMembers = "Course members is invalid"
			}

			// Ensure that "endpoints" is an array.
			if(!Array.isArray(cmd.courseEndpoints))
			{
				fieldResponse.courseMembers = "Course endpoints is invalid"
			}

			// Send a response indicating that courseMembers is invalid.
			if(Object.keys(fieldResponse).length !== 0)
			{
				client.send(JSON.stringify({
					status: "submitCourseFailed",
					fieldResponse: fieldResponse
				}))

				return
			}

			// The owner of the course.
			const owner = activeSessions[req.cookies.sessionToken].username

			// If the submitted course is a new course, try to add it.
			if(cmd.isNewCourse === "true")
			{
				db.query(
					"INSERT INTO courses (id, name, owner, members, endpoints) VALUES ($1, $2, $3, $4, $5)",
					[ cmd.courseId, cmd.courseName, owner, cmd.courseMembers, cmd.courseEndpoints],
					(err, result) => {
						onCourseSubmit(client, cmd, true, owner, err, result)
					}
				)
			}

			else if(cmd.isNewCourse === "false")
			{
				db.query(
					"UPDATE courses set members = $1, endpoints = $2, name = $3 WHERE id = $4 AND owner = $5",
					[cmd.courseMembers, cmd.courseEndpoints, cmd.courseName, cmd.courseId, owner ],
					(err, result) => {
						onCourseSubmit(client, cmd, false, owner, err, result)
					}
				)

				displayCourseMembers(cmd.courseId, (json) => {
					iterateCourseViewers(cmd.courseId, (client) => {
						client.send(json)
					})
				})
			}
		}
	})
})

function onCourseSubmit(client, cmd, isNew, owner, err, result)
{
	// TODO: Make sure that the error indicates duplicate key.
	// Right now this error is assumed.
	if(err)
	{
		console.log("Got error", err)

		// Send a response indicating that courseId was invalid.
		client.send(JSON.stringify({
			status: "submitCourseFailed",
			fieldResponse: {
				courseId: "Course " + cmd.courseId + " already exists."
			}
		}))
	}

	else
	{
		// Send a response indicating that the course config should be ended.
		client.send(JSON.stringify({
			status: "endCourseConfig",
		}))

		const json = JSON.stringify({
			status: "submitCourse",
			courseId: cmd.courseId,
			courseName: cmd.courseName,
			courseMembers: cmd.courseMembers,
			courseEndpoints: cmd.courseEndpoints,
			isNewCourse: isNew
		})

		iterateWebsocketClients("dashboard", (client) => {
			if(client.username === owner)
			{
				client.send(json)
			}
		})
	}
}

app.get("/view/:courseId", (req, res) => {
	if(validateLogin(req, res))
	{
		// Find the requested course if the requester owns it.
		db.query(
			"SELECT id FROM courses WHERE id = $1 AND owner = $2",
			[ req.params.courseId, activeSessions[req.cookies.sessionToken].username ],
			(err, result) => {

				// If no requester owned course of the given ID is found, go back to the root page.
				if(result.rows.length === 0)
				{
					res.redirect("/")
					return
				}

				res.sendFile("/frontend/html/view.html")
			}
		)
	}
})

app.ws("/view/:courseId", (client, req) => {
	// If no session token was provided, don't accept the connection.
	if(!hasValidSessionToken(req))
	{
		console.log("Reject connection because it has no session token")
		return
	}

	// Find the requested course if the requester owns it.
	db.query(
		"SELECT name, id FROM courses WHERE id = $1 AND owner = $2",
		[ req.params.courseId, activeSessions[req.cookies.sessionToken].username ],
		(err, result) => {

			// If no requester owned course of the given ID is found, go back to the root page.
			if(result.rows.length === 0)
			{
				return
			}

			client.tag = "view"
			client.viewedCourse = req.params.courseId

			client.send(JSON.stringify({
				status: "courseInfo",
				courseId: result.rows[0].id,
				courseName: result.rows[0].name,
			}))

			displayCourseMembers(client.viewedCourse, (json) => {
				client.send(json)
			})
		}
	)
})

app.post("/endpoint/register", (req, res) => {
	// Check if the endpoint supplied an existing ID.
	if("endpointId" in req.body)
	{
		// If an ID exists, make sure that endpoint is valid.
		validateEndpointAuthorized(req, res, (result) => {
			console.log("In register for existing ID ->", result.rows)
			endpointStatus = result.rows[0].status

			db.query(
				"SELECT * FROM courses WHERE $1 = ANY(endpoints)",
				[ req.body.endpointId ],
				(err, result) => {
					console.log("IN registered", result.rows)
					courses = {}

					result.rows.forEach((row) => {
						courses[row.id] = {
							courseName: row.name
						}
					})

					res.status(200)
					res.send(JSON.stringify({
						availableCourses: courses
					}))
				}
			)
		})
	}

	// The endpoint didn't supply an ID. Generate a new one and send it.
	else
	{
		const id = crypto.randomBytes(16).toString("hex")
		console.log("Create new ID", id)

		// Add the newly created endpoint ID to the database as a waiting endpoint.
		db.query(
			"INSERT INTO endpoints(id, status) VALUES($1, $2)",
			[ id, "waiting" ]
		)

		// Respond with "201 Created" to indicate that the
		// endpoint is still waiting for authorization.
		res.status(201)
		res.send(JSON.stringify({
			endpointId: id
		}))

		// Display the newly created endpoint on every active dashboard.
		displayEndpoints((json) => {
			iterateWebsocketClients("dashboard", (client) => {
				client.send(json)
			})
		})
	}
})

app.post("/endpoint/join/", (req, res) => {
	validateEndpointAuthorized(req, res, (result) => {
		validateCourse(req.body.courseId, res, () => {
			db.query(
				"SELECT id FROM courses WHERE id = $1 AND $2 = ANY(endpoints)",
				[ req.body.courseId, req.body.endpointId ],
				(err, result) => {
					if(result.rows.length === 0)
					{
						res.status(403)
						res.send("Unauthorized to access course")
					}

					else
					{
						db.query(
							"UPDATE endpoints SET currentcourse = $1",
							[ result.rows[0].id ], (err, result) => {
								console.log("Endpoint", req.body.endpointId, "Joins", req.body.courseId)

								res.status(200)
								res.send("Joined course")
							}
						)
					}
				}
			)
		})
	})
})

app.post("/endpoint/memberPresent", (req, res) => {

	// Make sure that the endpoint is authorized.
	validateEndpointAuthorized(req, res, (result) => {
		// Make sure that the given tag is associated with a user.
		db.query(
			"SELECT name, id, currentcourse FROM members WHERE tag = $1",
			[ req.body.memberTag ],
			(err, memberResult) => {
				// If there are no returned rows, no such tag exists.
				if(memberResult.rows.length === 0)
				{
					console.log("Tag", req.body.memberTag, "is not associated with a member")

					// Send "404 Not Found" to indicate that the tag is not registered.
					res.status(404)
					res.send("Tag not registered")

					return
				}

				// Check which course the endpoint has currently joined to.
				db.query(
					"SELECT currentcourse FROM endpoints WHERE id = $1",
					[ req.body.endpointId ], (err, courseResult) => {

						// Make sure that the endpoint is still authorized for the course.
						db.query(
							"SELECT id, name FROM courses WHERE id = $1 AND $2 = ANY(endpoints)",
							[ courseResult.rows[0].currentcourse, req.body.endpointId ],
							(err, result) => {

								// If nothing was returned, the endpoint is unauthorized for this course.
								if(result.rows.length === 0)
								{
									res.status(403)
									res.send("Unauthorized to access course")
								}

								else
								{
									// Make sure that the given user is on the course.
									db.query(
										"SELECT id FROM courses WHERE id = $1 AND $2 = ANY(members)",
										[ courseResult.rows[0].currentcourse, memberResult.rows[0].id ], (err, result) => {

											// If no rows are returned, the member is not found on the selected course.
											if(result.rows.length === 0)
											{
												res.status(202)
												res.send("Member not on course")

												return
											}

											// TODO: Log the member course activity in the database.

											// Update the current course of the member.
											db.query(
												"UPDATE members SET currentcourse = $1 WHERE id = $2",
												[ courseResult.rows[0].currentcourse, memberResult.rows[0].id ],
												(err, result) => {

													// Send the name of the received user to the endpoint.
													res.status(200)
													res.send(JSON.stringify({
														userName: memberResult.rows[0].name
													}))

													// For each client that's viewing this course, update the member info.
													displayCourseMembers(courseResult.rows[0].currentcourse, (json) => {
														// TODO: Instead of "memberSync", a more lightweight state change message could be used.
														iterateCourseViewers(courseResult.rows[0].currentcourse, (client) => {
															client.send(json)
														})
													})

													// Is the member joining another course?
													if(memberResult.rows[0].currentcourse !== courseResult.rows[0].currentcourse)
													{
														// TODO: Instead of "memberSync", a more lightweight state change message could be used.
														displayCourseMembers(memberResult.rows[0].currentcourse, (json) => {
															iterateCourseViewers(memberResult.rows[0].currentcourse, (client) => {
																client.send(json)
															})
														})
													}
												}
											)
										}
									)
								}
							}
						)
					}
				)
			}
		)
	})
})

app.post("/endpoint/registerMember", (req, res) => {
	validateEndpointAuthorized(req, res, (result) => {
		db.query(
			"INSERT INTO members(id, name, tag) VALUES ($1, $2, $3)",
			[ req.body.memberId, req.body.memberName, req.body.memberTag ],
			(err, result) => {
				if(err)
				{
					res.status(403)
					if(err.detail.startsWith("Key (id)"))
					{
						console.log("Invalid id")
						res.send(JSON.stringify({
							invalidField: "id"
						}))
					}

					else if(err.detail.startsWith("Key (tag)"))
					{
						console.log("Invalid tag")
						res.send(JSON.stringify({
							invalidField: "tag"
						}))
					}

					else
					{
						// TODO: Set status as 5xx.
						res.send(JSON.stringify({
							invalidField: "unknown"
						}))
					}
				}

				else
				{
					res.status(201)
					res.send("Registered member")

					displayMembers((json) => {
						iterateWebsocketClients("dashboard", (client) => {
							client.send(json)
						})
					})
				}
			}
		)
	})
})

app.listen(3000, () => {
	console.log("Express is up")
});

db.connect((err) => {
	if(err)
	{
		throw err
	}

	console.log("Connected to postgres")

	// Ensure the "endpoints" table exists.
	db.query(`CREATE TABLE IF NOT EXISTS endpoints (
		id VARCHAR(50) PRIMARY KEY,
		status VARCHAR(50) NOT NULL,
		currentcourse VARCHAR(50)
	);`)

	// Ensure the "courses" table exists.
	db.query(`CREATE TABLE IF NOT EXISTS courses (
		id VARCHAR(50) PRIMARY KEY,
		name VARCHAR(50) NOT NULL,
		owner VARCHAR(50) NOT NULL,
		members TEXT [],
		endpoints TEXT []
	);`)

	// Ensure the "members" table exists.
	db.query(`CREATE TABLE IF NOT EXISTS members (
		id VARCHAR(50) PRIMARY KEY,
		name VARCHAR(50) NOT NULL,
		tag VARCHAR(50) UNIQUE,
		currentcourse VARCHAR(50)
	);`)
})
