const express = require("express")
const crypto = require("crypto")
const app = require("./app")
const db = require("./database")
const display = require("./displayData")

const router = express.Router()

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


function getEndpoint(id, callback)
{
	const result = db.query(
		"SELECT id, status FROM endpoints WHERE id = $1",
		[ id ], (err, result) => {
			callback(result)
		}
	)
}

router.post("/register", (req, res) => {
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
		if(!("endpointName" in req.body))
		{
			res.status(401)
			res.send("Missing endpoint name")

			return
		}

		const id = crypto.randomBytes(16).toString("hex")
		console.log("Create new ID", id)

		// Add the newly created endpoint ID to the database as a waiting endpoint.
		db.query(
			"INSERT INTO endpoints(id, name, status) VALUES($1, $2, $3)",
			[ id, req.body.endpointName, "waiting" ],
			(err, result) => {
				// TODO: Handle the unlikely case of a duplicate ID.

				// Respond with "201 Created" to indicate that the
				// endpoint is still waiting for authorization.
				res.status(201)
				res.send(JSON.stringify({
					endpointId: id
				}))

				// Display the newly created endpoint on every active dashboard.
				display.endpoints((json) => {
					app.iterateWebsocketClients("dashboard", (client) => {
						client.send(json)
					})
				})
			}
		)
	}
})

router.post("/join/", (req, res) => {
	validateEndpointAuthorized(req, res, (result) => {
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

router.post("/memberPresent", (req, res) => {

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
													display.courseMembers(courseResult.rows[0].currentcourse, (json) => {
														// TODO: Instead of "memberSync", a more lightweight state change message could be used.
														app.iterateCourseViewers(courseResult.rows[0].currentcourse, (client) => {
															client.send(json)
														})
													})

													// Is the member joining another course?
													if(memberResult.rows[0].currentcourse !== courseResult.rows[0].currentcourse)
													{
														// TODO: Instead of "memberSync", a more lightweight state change message could be used.
														display.courseMembers(memberResult.rows[0].currentcourse, (json) => {
															app.iterateCourseViewers(memberResult.rows[0].currentcourse, (client) => {
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

router.post("/registerMember", (req, res) => {
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

					display.allMembers((json) => {
						app.iterateWebsocketClients("dashboard", (client) => {
							client.send(json)
						})
					})
				}
			}
		)
	})
})

module.exports = router
