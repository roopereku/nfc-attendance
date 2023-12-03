function getCookieValue(name)
{
	return document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)')?.pop() || ''
}

const websocketPath = "/view/" + getCookieValue("courseId")

function onWebsocketMessage(msg)
{
	if(msg.status === "memberSync")
	{
		msg.members.forEach((member) => {
			displayMember(member.memberId, member.memberName)
		})
	}
}

function displayMember(memberId, memberName)
{
	const element = document.createElement("button")
	const area = document.getElementById("memberArea")

	element.className = "btn btn-secondary mx-1 my-1"
	element.innerHTML = memberName
	element.dataset.id = memberId

	area.appendChild(element)
}
