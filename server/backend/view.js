const express = require("express")
const websocket = require("express-ws")
const app = require("./app")
const db = require("./database")
const display = require("./displayData")

const router = express.Router()

router.get("/:courseId", (req, res) => {
	if(app.validateLogin(req, res))
	{
		// Find the requested course if the requester owns it.
		db.query(
			"SELECT id FROM courses WHERE id = $1 AND owner = $2",
			[ req.params.courseId, app.getUsername(req) ],
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

router.ws("/:courseId", (client, req) => {
	// If no session token was provided, don't accept the connection.
	if(!app.hasValidSessionToken(req))
	{
		console.log("Reject connection because it has no session token")
		return
	}

	// Find the requested course if the requester owns it.
	db.query(
		"SELECT name, id FROM courses WHERE id = $1 AND owner = $2",
		[ req.params.courseId, app.getUsername(req) ],
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

			display.courseMembers(client.viewedCourse, (json) => {
				client.send(json)
			})
		}
	)
})

module.exports = router
