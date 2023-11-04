const express = require("express")
const app = express()
const port = 3000

let courses = {
	"ABCD1" : {
		name: "Test course 1"
	},

	"ABCD2" : {
		name: "Test course 2"
	}
}

app.use(express.static("/frontend"))
app.use(express.static("/backend/node_modules/bootstrap/dist/"))

app.get("/", (req, res) => {
	res.sendFile("/frontend/html/index.html")
})

app.get("/view/:courseId", (req, res) => {
	// TODO: Send ID as well.
	res.sendFile("/frontend/html/view.html")
})

app.get("/courses", (req, res) => {
	res.send(JSON.stringify(courses))
})

app.listen(port, () => {
})
