function getCookieValue(name)
{
	return document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')?.pop() || ''
}

const websocketPath = "/view/" + getCookieValue("courseId")

function onWebsocketMessage(msg)
{
}

function displayUser(userId, userName)
{
	const element = document.createElement("button")
	const area = document.getElementById("userArea")

	element.className = "btn btn-secondary mx-1 my-1"
	element.innerHTML = userName
	element.dataset.id = userId

	area.appendChild(element)
}

for(let i = 0; i < 20; i++)
	displayUser("testid", "Test user")
