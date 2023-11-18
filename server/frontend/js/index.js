let courses = {}

function launchDashboard()
{
	// Redirect the user to the dashboard page.
	location.href = "/dashboard"
}

function startViewing()
{
	// Redirect the user to the viewing page.
	const start = document.getElementById("start-button")
	location.href = "/view/" + start.dataset.selectedId
}

function updateSelectedCourse(id)
{
	// Update the start button text and store the ID.
	const start = document.getElementById("start-button")
	start.dataset.selectedId = id
	start.innerHTML = "Start viewing " + courses[id].name
}

function addCoursesToList()
{
	const list = document.getElementById("courses-list")

	for(const [key, value] of Object.entries(courses))
	{
		let item = document.createElement("li")
		let element = document.createElement("a")

		element.className = "dropdown-item"
		element.innerHTML = value.name
		element.href = "#"

		element.dataset.courseId = key

		item.appendChild(element)
		list.appendChild(item)
	}
}

fetch("/courses")
	.then((data) => data.json())
	.then((data) =>
{
	courses = data
	const first = Object.keys(courses)[0]

	addCoursesToList()
	updateSelectedCourse(first)
})
