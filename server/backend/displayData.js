const db = require("./database")

module.exports.courseMembers = (courseId, callback) => {
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
							delete row.currentcourse
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

module.exports.allMembers = (callback) => {
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

module.exports.endpoints = (callback) => {
	db.query(
		"SELECT id, name, status FROM endpoints",
		(err, result) => {
			const json = JSON.stringify({
				status: "endpointSync",
				endpoints: result.rows
			})

			callback(json)
		}
	)
}


