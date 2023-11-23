const websocketPath = "/dashboard/"

function addWaitingEndpoint(id)
{
	const endpointList = document.getElementById("endpointList")

	const entry = document.createElement("div")
	entry.className = "border border-secondary mx-1 my-1"
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

function onWebsocketMessage(msg)
{
	if(msg.status === "newEndpoint")
	{
		addWaitingEndpoint(msg.endpointId)
	}
}

addWaitingEndpoint("TESTID")
