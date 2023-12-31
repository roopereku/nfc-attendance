function switchToMainMenu()
{
	location.href = "/"
}

const websocketPath = location.pathname

function onWebsocketMessage(msg)
{
	if(msg.status === "courseInfo")
	{
		document.getElementById("courseName").innerHTML = msg.courseName
	}

	if(msg.status === "memberSync")
	{
		document.getElementById("memberArea").replaceChildren()

		msg.members.forEach((member) => {
			displayMember(member.id, member.name, member.isPresent)
		})
	}
}

function displayMember(memberId, memberName, isPresent)
{
	const element = document.createElement("button")
	const area = document.getElementById("memberArea")

	const bg = isPresent ? "btn-success" : "btn-secondary"

	element.className = "btn " + bg + " mx-2 my-2"
	element.innerHTML = memberName
	element.dataset.id = memberId

	area.appendChild(element)
}
