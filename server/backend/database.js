const postgres = require("pg")

const db = new postgres.Client({
	user: "nfcuser",
	password: "nfcpass",
	host: "postgres",
	database: "nfcattendance",
	port: 5432,
})

db.connect((err) => {
	if(err)
	{
		throw err
	}

	console.log("Connected to postgres")

	// Ensure the "endpoints" table exists.
	db.query(`CREATE TABLE IF NOT EXISTS endpoints (
		id VARCHAR(50) PRIMARY KEY,
		name VARCHAR(50) NOT NULL,
		status VARCHAR(50) NOT NULL,
		currentcourse VARCHAR(50)
	);`)

	// Ensure the "courses" table exists.
	db.query(`CREATE TABLE IF NOT EXISTS courses (
		id VARCHAR(50) PRIMARY KEY,
		name VARCHAR(50) NOT NULL,
		owner VARCHAR(50) NOT NULL,
		members TEXT [],
		endpoints TEXT []
	);`)

	// Ensure the "members" table exists.
	db.query(`CREATE TABLE IF NOT EXISTS members (
		id VARCHAR(50) PRIMARY KEY,
		name VARCHAR(50) NOT NULL,
		tag VARCHAR(50) UNIQUE,
		currentcourse VARCHAR(50)
	);`)
})

module.exports = db
