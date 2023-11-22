function tryLogin()
{
	const inputUsername = document.getElementById("inputUsername")
	const inputPassword = document.getElementById("inputPassword")

	console.log(inputPassword.value)

	fetch("/getSessionToken", {
		method: 'POST',
		headers: {
		  'Accept': 'application/json',
		  'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			username: inputUsername.value,	
			password: inputPassword.value,	
		})
	})
	.then((response) => {
		console.log(response.status)

		if(response.status === 200)
		{
			location.href = "/"
		}

		else if(response.status == 401)
		{
			inputUsername.classList.add("text-danger")
			inputPassword.classList.add("text-danger")

			setInterval(() => {
				inputUsername.classList.remove("text-danger")
				inputPassword.classList.remove("text-danger")
			}, 3000)
		}
	})
}
