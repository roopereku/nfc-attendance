const express = require("express")
const websocket = require("express-ws")
const app = require("./app")
const db = require("./database")
const display = require("./displayData")

const router = express.Router()

router.get("/", (req, res) => {
	if(app.validateLogin(req, res))
	{
		res.sendFile("/frontend/html/dashboard.html")
	}
})

router.ws("/", (client, req) => {
	// If no session token was provided, don't accept the connection.
	if(!app.hasValidSessionToken(req))
	{
		console.log("Reject connection because it has no session token")
		return
	}

	client.tag = "dashboard"
	client.username = app.getUsername(req)

	// Send all available members to the dashboard client.
	display.allMembers((json) => {
		app.iterateWebsocketClients("dashboard", (client) => {
			client.send(json)
		})
	})

	// Send all available endpoints to the dashboard client.
	display.endpoints((json) => {
		app.iterateWebsocketClients("dashboard", (client) => {
			client.send(json)
		})
	})

	// Send all available courses to the dashboard client.
	db.query(
		"SELECT * FROM courses WHERE owner = $1",
		[ app.getUsername(req) ], (err, result) => {
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
			return
		}

		if(cmd.status == "authorizeEndpoint")
		{
			db.query(
				"UPDATE endpoints SET status = $1 WHERE id = $2",
				[ "authorized", cmd.endpointId ], (err, result) => {
					display.endpoints((json) => {
						app.iterateWebsocketClients("dashboard", (client) => {
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
					display.endpoints((json) => {
						app.iterateWebsocketClients("dashboard", (client) => {
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
			const owner = app.getUsername(req)

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

				display.courseMembers(cmd.courseId, (json) => {
					app.iterateCourseViewers(cmd.courseId, (client) => {
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

		app.iterateWebsocketClients("dashboard", (client) => {
			if(client.username === owner)
			{
				client.send(json)
			}
		})
	}
}

module.exports = router
