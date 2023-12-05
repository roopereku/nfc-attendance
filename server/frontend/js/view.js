function getCookieValue(name)
{
	return document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')?.pop() || ''
}

const websocketPath = "/view/" + getCookieValue("courseId")

function onWebsocketMessage(msg)
{
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

	element.className = "btn " + bg + " mx-1 my-1"
	element.innerHTML = memberName
	element.dataset.id = memberId

	area.appendChild(element)
}
