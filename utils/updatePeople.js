require('dotenv').config()
const mongoose = require('mongoose')
const env = process.env
const config = require('../config')
const People = require('../models/People')
const axios = require('axios')

const termColors = {
	black: '\x1b[30m%s\x1b[30m',
	red: '\x1b[31m%s\x1b[31m',
	green: '\x1b[32m%s\x1b[32m',
	yellow: '\x1b[33m%s\x1b[33m',
	blue: '\x1b[34m%s\x1b[34m',
	magenta: '\x1b[35m%s\x1b[35m',
	cyan: '\x1b[36m%s\x1b[36m',
	white: '\x1b[37m%s\x1b[37m',
}

async function getUpdatedPeople() {
	// get todays date in DD-MM-YYYY format (separator is a dash)
	const today = new Date().toLocaleDateString('fr-FR').split('/').join('-')
	// const today = '22-03-2023'
	let updatedPeople = await axios
		.get(`https://jorfsearch.steinertriples.ch/${today}?format=JSON`)
		.then((res) => res.data)
	// remove duplicate people (the ones who have the same nom and prenom)
	updatedPeople = updatedPeople.filter(
		(person, index, self) =>
			index ===
			self.findIndex((t) => t.nom === person.nom && t.prenom === person.prenom)
	)
	return updatedPeople
}

async function getRelevantPeopleFromDb(list) {
	// only get people from db that match the list of people from JORF (same nom and prenom)
	// if list is empty, dont get anything from db
	if (list.length === 0) return []
	return await People.find(
		{
			$or: list.map((person) => ({
				nom: person.nom,
				prenom: person.prenom,
			})),
		},
		{ _id: 1, prenom: 1, nom: 1 }
	)
}

async function updatePeople(updatedUsers, relevantPeople) {
	let total = 0
	for await (let user of updatedUsers) {
		for await (let person of relevantPeople) {
			if (person.prenom === user.prenom && person.nom === user.nom) {
				person.lastKnownPosition = user
				await person.save()
				console.log(
					termColors.white,
					`${person.nom} ${person.prenom} was updated`
				)
				total++
			}
		}
	}
	console.log(termColors.green, `${total} people were updated`)
	return
}

mongoose.set('strictQuery', false)
mongoose
	.connect(env.MONGODB_URI, config.mongodb)
	.then(async () => {
		const updatedPeople = await getUpdatedPeople()
		const relevantPeople = await getRelevantPeopleFromDb(updatedPeople)
		await updatePeople(updatedPeople, relevantPeople)
		process.exit(0)
	})
	.catch((err) => {
		console.log(err)
		process.exit(1)
	})
