const express = require("express")
const https = require("https")
const fs = require("fs")

const app = express()
const server = initServer()

function ensurePathExists(path)
{
	if(!fs.existsSync(path))
	{
		console.error(path + " does not exist")
		process.exit(1)
	}
}

function initServer()
{
	ensurePathExists("/backend/cert")
	ensurePathExists("/backend/cert/key.pem")
	ensurePathExists("/backend/cert/cert.pem")

	const key = fs.readFileSync('/backend/cert/key.pem');
	const cert = fs.readFileSync('/backend/cert/cert.pem');

	return https.createServer({key: key, cert: cert }, app);
}

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

app.get("/dashboard", (req, res) => {
	res.sendFile("/frontend/html/dashboard.html")
})

app.get("/view/:courseId", (req, res) => {
	// TODO: Send ID as well.
	res.sendFile("/frontend/html/view.html")
})

app.get("/courses", (req, res) => {
	res.send(JSON.stringify(courses))
})

server.listen(3000, () => {
})
