const websocketPath = "/dashboard/"
const courseConfigModal = new bootstrap.Modal(document.getElementById("courseConfig"), {})

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

	else if(msg.status === "courseSync") {
		msg.courses.forEach((course) => {
			addCourse(course.courseId, course.courseName, course.courseMembers)
		})
	}

	else if(msg.status === "submitCourse")
	{
		if(msg.isNewCourse)
		{
			addCourse(msg.courseId, msg.courseName, msg.courseMembers)
		}

		else
		{
			editCourse(msg.courseId, msg.courseName, msg.courseMembers)
		}
	}

	else if(msg.status === "endCourseConfig")
	{
		courseConfigModal.hide()
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

function editCourse(courseId, newName, newMembers)
{
	const course = document.getElementById("courseEntry-" + courseId)
	course.innerHTML = newName + " (" + courseId + ")"

	course.dataset.courseData = JSON.stringify({
		courseId: courseId,
		courseName: newName,
		courseMembers: newMembers
	})
}

function addCourse(courseId, courseName, courseMembers)
{
	const courseList = document.getElementById("courseList")

	const element = document.createElement("li")
	element.id = "courseEntry-" + courseId
	element.className = "list-group-item btn btn-secondary"

	courseList.appendChild(element)
	editCourse(courseId, courseName, courseMembers)
	
	element.addEventListener("click", (e) => {
		displayCourseConfig(false, e.target.dataset.courseData)
	})
}

function addAuthorizedEndpoint(endpointId)
{
	const endpointsList = document.getElementById("permittedEndpointsList")
}

function addMember(memberId, memberName)
{
	const membersList = document.getElementById("permittedMembersList")

	let item = document.createElement("li")

	let checkbox = document.createElement("input")
	checkbox.className = "from-check-input mx-1"
	checkbox.type = "checkbox"

	let name = document.createTextNode(memberName)
	item.className = "list-group-item memberEntry"

	item.appendChild(checkbox)
	item.appendChild(name)

	item.dataset.memberId = memberId
	membersList.appendChild(item)
}

function displayCourseConfig(isNewCourse, courseData = undefined)
{
	console.log(courseData)

	const title = document.getElementById("courseTitle")
	const submit = document.getElementById("submitCourseButton")
	const courseId = document.getElementById("courseId")

	submit.dataset.newCourse = isNewCourse

	if(isNewCourse)
	{
		title.innerHTML = "Add a new course"
		submit.innerHTML = "Add course"

		courseId.disabled = false
	}

	else
	{
		title.innerHTML = "Edit course"
		submit.innerHTML = "Edit"

		const courseName = document.getElementById("courseName")
		const data = JSON.parse(courseData)

		courseId.value = data.courseId
		courseName.value = data.courseName

		courseId.disabled = true

		membersInList = document.getElementsByClassName("memberEntry")
		for (const [key, value] of Object.entries(membersInList))
		{
			value.children[0].checked = data.courseMembers.includes(value.dataset.memberId)
		}
	}

	courseConfigModal.show()
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

	members = []
	membersInList = document.getElementsByClassName("memberEntry")

	for (const [key, value] of Object.entries(membersInList))
	{
		if(value.children[0].checked)
		{
			members.push(value.dataset.memberId)
		}
	}

	console.log(submit.dataset.newCourse)

	ws.send(JSON.stringify({
		status: "submitCourse",
		isNewCourse: submit.dataset.newCourse,
		courseName: name.value,
		courseId: id.value,
		courseMembers: members
	}))
}

switchToCourses()
addWaitingEndpoint("TESTID")

addMember("MEMBERID1", "Member name 1")
addMember("MEMBERID2", "Member name 2")
