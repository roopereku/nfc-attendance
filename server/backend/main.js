const app = require("./app")

app.addRoute("/endpoint", require("./endpoint"))
app.addRoute("/dashboard", require("./dashboard"))
app.addRoute("/view", require("./view"))

app.start()
