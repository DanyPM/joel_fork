require("dotenv").config();
const mongoose = require("mongoose");
const env = process.env;
const config = require("../config");
const People = require("../models/People");
const User = require("../models/User");
const axios = require("axios");
const { formatSearchResult } = require("../utils/formatSearchResult");
const { splitText } = require("../utils/sendLongText");
const { createHash } = require("node:crypto");
const { send } = require("./umami");

function addTypeOrdre(elem) {
  const female = elem.sexe == "F";
  switch (elem.type_ordre) {
    case "nomination":
      return `A été nommé${female ? "e" : ""} à:`;
    case "réintégration":
      return `A été réintégré${female ? "e" : ""} à:`;
    case "cessation de fonction":
      return `A cessé ses fonctions à:`;
    case "affectation":
      return `A été affecté${female ? "e" : ""} à:`;
    case "délégation de signature":
      return `A reçu une délégation de signature à:`;
    case "promotion":
      return `A été promu${female ? "e" : ""}:`;
    case "admission":
      return `A été admis${female ? "e" : ""} à:`;
    case "inscription":
      return `A été inscrit${female ? "e" : ""} à:`;
    case "désignation":
      return `A été désigné${female ? "e" : ""} à:`;
    case "détachement":
      return `A été détaché${female ? "e" : ""} à:`;
    case "radiation":
      return `A été radié${female ? "e" : ""} à:`;
    case "renouvellement":
      return `A été renouvelé${female ? "e" : ""} à:`;
    case "reconduction":
      return `A été reconduit${female ? "e" : ""} à:`;
    case "élection":
      return `A été élu${female ? "e" : ""} à:`;
    case "admissibilite":
      return `A été admissible à:\n`;
    default:
      return `A été ${elem.type_ordre} à:`;
  }
}

function addPoste(elem) {
  let message = "";
  if (elem.organisations && elem.organisations[0]?.nom) {
    return elem.organisations[0].nom;
  } else if (elem.ministre) {
    return elem.ministre;
  } else if (elem.inspecteur_general) {
    return `Inspecteur général des ${elem.inspecteur_general}`;
  } else if (elem.grade) {
    message += `au grade de ${elem.grade}`;
    if (elem.ordre_merite) {
      message += ` de l'Ordre national du mérite`;
    } else if (elem.legion_honneur) {
      message += ` de la Légion d'honneur`;
    }
    return (message += `${elem.nomme_par ? ` par le ${elem.nomme_par}` : ""}`);
  } else if (elem.autorite_delegation) {
    return `par le ${elem.autorite_delegation}`;
  }
  return message;
}

function addLinkJO(elem) {
  if (elem.source_id) {
    switch (elem.source_name) {
      case "BOMI":
        return `https://bodata.steinertriples.ch/${elem.source_id}.pdf`;
      default:
        return `https://www.legifrance.gouv.fr/jorf/id/${elem.source_id}`;
    }
  }
  return "https://www.legifrance.gouv.fr/";
}

// only retrieve people who have been updated on same day
async function getPeople() {
  // get date in format YYYY-MM-DD
  const currentDate = new Date().toISOString().split("T")[0];
  // const currentDate = "2024-02-08";
  const people = await People.find(
    {
      updatedAt: {
        $gte: new Date(currentDate),
      },
    },
    { _id: 1, lastKnownPosition: 1, updatedAt: 1 }
  );
  return people;
}

// the argument is a list of _id of people who have been updated
// retrieve all users who follow at least one of these people
async function getUsers(updatedPeople) {
  const peopleIdStringArray = returnIdsArray(updatedPeople).map((id) =>
    id.toString()
  );
  const currentDate = new Date().toISOString().split("T")[0];
  const users = await User.find(
    {
      $or: [
        {
          followedPeople: {
            $elemMatch: {
              peopleId: {
                $in: peopleIdStringArray,
              },
            },
          },
        },
        {
          followedFunctions: {
            $ne: [],
          },
        },
      ],
    },
    { _id: 1, followedPeople: 1, followedFunctions: 1, chatId: 1 }
  );

  for (let user of users) {
    let followed = [];
    for (let followedPerson of user.followedPeople) {
      const idUpdated = peopleIdStringArray.includes(
        followedPerson.peopleId.toString()
      );
      const lastUpdate = new Date(followedPerson.lastUpdate)
        .toISOString()
        .split("T")[0];
      if (idUpdated && lastUpdate !== currentDate) {
        followed.push(followedPerson);
      }
    }
    user.followedPeople = followed;
  }
  return users;
}

async function sendUpdate(user, peopleUpdated) {
  if (!user.chatId) {
    console.log(
      `Can't send notifications to ${user._id}. Must run /start again to update his chatId.`
    );
    return;
  }

  // use mongoose to retrive all people that the user follows using a tag
  // tags are stored in the user.followedFunctions array
  // we know a person belongs to a tag if the tag is a key in the person lastKnownPosition object which equals to the string "true"
  const tagsList = user.followedFunctions;
  let peopleFromFunctions = {};
  if (tagsList) {
    for (let tag of tagsList) {
      // get all people that have a lastKnownPosition object with a key that equals to the tag
      // and that have been updated today
      let listOfPeopleFromTag = await People.find(
        {
          [`lastKnownPosition.${tag}`]: {
            $exists: true,
          },
          updatedAt: {
            $gte: new Date(new Date().toISOString().split("T")[0]),
          },
        },
        { _id: 1, lastKnownPosition: 1, updatedAt: 1 }
      );
      if (listOfPeopleFromTag.length > 0) {
        peopleFromFunctions[tag] = listOfPeopleFromTag;
      }
    }
  }

  if (Object.keys(peopleFromFunctions).length > 0 || peopleUpdated.length > 0) {
    let notification_text =
      "📢 Aujourd'hui, il y a eu de nouvelles publications pour les personnes que vous suivez !\n\n";

    for (let person of peopleUpdated) {
      notification_text += `Nouvelle publication pour *${person.lastKnownPosition.prenom} ${person.lastKnownPosition.nom}*\n`;
      notification_text += formatSearchResult([person.lastKnownPosition], {
        isListing: true,
      });
      if (peopleUpdated.indexOf(person) + 1 !== peopleUpdated.length)
        notification_text += "\n";
    }

    for (let tag in peopleFromFunctions) {
      notification_text += "====================\n\n";
      notification_text += `Nouvelle publication pour les personnes suivies avec le tag *${tag}*:\n\n`;
      for (let person of peopleFromFunctions[tag]) {
        notification_text += `*${person.lastKnownPosition.prenom} ${person.lastKnownPosition.nom}*\n`;
        notification_text += formatSearchResult([person.lastKnownPosition], {
          isListing: true,
        });
        if (
          peopleFromFunctions[tag].indexOf(person) + 1 ===
          peopleFromFunctions[tag].length
        )
          notification_text += "\n";
      }
      if (
        Object.keys(peopleFromFunctions).indexOf(tag) + 1 !==
        Object.keys(peopleFromFunctions).length
      )
        notification_text += "\n";
    }

    const messagesArray = splitText(notification_text, 3000);

    for await (let message of messagesArray) {
      await axios.post(
        `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`,
        {
          chat_id: user.chatId,
          text: message,
          parse_mode: "markdown",
          link_preview_options: {
            is_disabled: true,
          },
        }
      );
    }

    await send("/notification-update", {
      chatId: createHash("sha256").update(user.chatId.toString()).digest("hex"),
    });

    console.log(`Sent notification to ${user._id}`);
  }
}

async function populatePeople(user, peoples) {
  const peopleUpdated = [];
  for await (let followedPerson of user.followedPeople) {
    const person = peoples.find(
      (person) => person._id.toString() === followedPerson.peopleId.toString()
    );
    if (person) {
      peopleUpdated.push(person);
    }
  }
  return peopleUpdated;
}

async function updateUser(user, peoples) {
  const peoplesIdArray = returnIdsArray(peoples).map((id) => id.toString());
  const userFromDb = await User.findById(user._id);

  for (let followedPerson of userFromDb.followedPeople) {
    if (peoplesIdArray.includes(followedPerson.peopleId.toString())) {
      followedPerson.lastUpdate = new Date();
    }
  }
  // remove duplicated in followedPeople array that have same peopleId (can happen if user has followed a person twice)
  userFromDb.followedPeople = userFromDb.followedPeople.filter(
    (followedPerson, index, self) =>
      index ===
      self.findIndex(
        (t) => t.peopleId.toString() === followedPerson.peopleId.toString()
      )
  );
  // save user
  await userFromDb.save();
}

async function notifyUsers(users, peoples) {
  for await (let user of users) {
    // create an array of people who have been updated
    let peopleUpdated = await populatePeople(user, peoples);
    if (peopleUpdated.length || user.followedFunctions.length) {
      // remove duplicates from peopleUpdated array
      peopleUpdated = peopleUpdated.filter(
        (person, index, self) =>
          index ===
          self.findIndex((t) => t._id.toString() === person._id.toString())
      );
      // update field updatedAt in followedPeople
      await updateUser(user, peoples);
      // send notification to user
      await sendUpdate(user, peopleUpdated);
    }
    // prevent hitting Telegram API rate limit
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

function returnIdsArray(arr) {
  let res = [];
  for (let item of arr) {
    res.push(item._id);
  }
  return res;
}

mongoose.set("strictQuery", false);
mongoose
  .connect(env.MONGODB_URI, config.mongodb)
  .then(async () => {
    // 1. get all people who have been updated today
    const peoples = await getPeople();
    const peopleIds = returnIdsArray(peoples);
    // 2. get all users who follow at least one of these people
    const users = await getUsers(peopleIds);
    // 3. send notification to users
    await notifyUsers(users, peoples);
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
