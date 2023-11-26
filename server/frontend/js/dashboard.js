const websocketPath = "/dashboard/"

function displayView(id)
{
	const views = document.getElementsByClassName("dashboardView")

	for (const [key, value] of Object.entries(views))
	{
		value.hidden = value.id !== id
	}
}

function switchToCourses()
{
	displayView("courseView")
}

function switchToEndpoints()
{
	displayView("endpointView")
}

function switchToMainMenu()
{
	location.href = "/"
}

function addWaitingEndpoint(id)
{
	const endpointList = document.getElementById("endpointList")

	const entry = document.createElement("div")
	entry.className = "border border-secondary mx-1 my-1 waitingEndpoint"
	entry.dataset.endpointId = id

	const title = document.createElement("h5")
	title.className = "text-light text-center"
	title.innerHTML = id

	const buttons = document.createElement("div")
	buttons.className = "d-flex justify-content-center my-1"

	const authorize = document.createElement("button")
	authorize.className = "btn btn-success mx-1"
	authorize.innerHTML = "Authorize"

	const block = document.createElement("button")
	block.className = "btn btn-danger mx-1"
	block.innerHTML = "Block"

	authorize.addEventListener("click", (e) => {
		ws.send(JSON.stringify({
			status: "authorizeEndpoint",
			endpointId: e.target.parentElement.parentElement.dataset.endpointId
		}))
	})

	block.addEventListener("click", (e) => {
		ws.send(JSON.stringify({
			status: "blockEndpoint",
			endpointId: e.target.parentElement.parentElement.dataset.endpointId
		}))
	})

	entry.appendChild(title)
	entry.appendChild(buttons)

	buttons.appendChild(authorize)
	buttons.appendChild(block)

	endpointList.appendChild(entry)
}

function removeWaitingEndpoint(id)
{
	const endpoints = document.getElementsByClassName("waitingEndpoint")

	for (const [key, value] of Object.entries(endpoints))
	{
		if(value.dataset.endpointId === id)
		{
			value.remove()
		}
	}
}

function onWebsocketMessage(msg)
{
	if(msg.status === "newEndpoint")
	{
		addWaitingEndpoint(msg.endpointId)
	}

	else if(msg.status === "processedEndpoint")
	{
		removeWaitingEndpoint(msg.endpointId)
	}

	else if(msg.status === "waitingEndpointSync")
	{
		msg.endpoints.forEach((id) => {
			addWaitingEndpoint(id)
		})
	}

	else if(msg.status === "newCourseAdded")
	{
		addCourse(msg.courseId)
	}

	else if(msg.status === "submitCourseFailed")
	{
		for (const [key, value] of Object.entries(msg.fieldResponse))
		{
			// NOTE: As long as the ID names match the JSON field names,
			// the original input element can be found using a backend provided key.
			const target = document.getElementById(key)

			target.classList.remove("is-valid")
			target.classList.add("is-invalid")

			const targetError = document.getElementById(key + "Error")
			if(targetError)
			{
				targetError.innerHTML = value
			}
		}
	}
}

function addCourse(courseId)
{
	const courseList = document.getElementById("courseList")

	const element = document.createElement("li")
	element.className = "list-group-item"
	element.innerHTML = courseId

	courseList.appendChild(element)
}

function displayCourseConfig(isNewCourse)
{
	// TODO: Hide members, endpoints if a new course is being configured.

	const title = document.getElementById("courseTitle")
	const submit = document.getElementById("submitCourseButton")

	submit.dataset.newCourse = isNewCourse

	if(isNewCourse)
	{
		title.innerHTML = "Add a new course"
		submit.innerHTML = "Add course"
	}

	else
	{
		title.innerHTML = "Edit course"
		submit.innerHTML = "Edit"
	}

	const modal = new bootstrap.Modal(document.getElementById("courseConfig"), {})
	modal.show()
}

function submitCourse()
{
	const courseConfig = document.getElementById("courseConfig")
	const toValidate = courseConfig.getElementsByClassName("needs-validation")
	let invalidFields = 0

	for (const [key, value] of Object.entries(toValidate))
	{
		if(value.checkValidity())
		{
			value.classList.remove("is-invalid")
			value.classList.add("is-valid")
		}

		else
		{
			value.classList.remove("is-valid")
			value.classList.add("is-invalid")

			invalidFields++
		}
	}

	if(invalidFields > 0)
	{
		return
	}

	const submit = document.getElementById("submitCourseButton")
	const name = document.getElementById("courseName")
	const id = document.getElementById("courseId")

	ws.send(JSON.stringify({
		status: "submitCourse",
		isNewCourse: submit.dataset.newCourse,
		courseName: name.value,
		courseId: id.value,
	}))
}

//switchToEndpoints()
switchToCourses()
addWaitingEndpoint("TESTID")
