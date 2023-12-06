const app = require("./app.js")
const db = require("./database")
const display = require("./displayData")

app.addRoute("/endpoint", require("./endpoint"))
app.addRoute("/dashboard", require("./dashboard"))
app.addRoute("/view", require("./view"))

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

app.start()
