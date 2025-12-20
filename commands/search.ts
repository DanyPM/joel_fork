import { formatSearchResult } from "../utils/formatSearchResult.ts";
import {
  callJORFSearchPeople,
  cleanPeopleName
} from "../utils/JORFSearch.utils.ts";
import { IPeople, ISession } from "../types.ts";
import { Types } from "mongoose";
import User from "../models/User.ts";
import People from "../models/People.ts";
import { JORFSearchItem } from "../entities/JORFSearchResponse.ts";
import {
  containsNumber,
  removeSpecialCharacters
} from "../utils/text.utils.ts";
import {
  cloneKeyboard,
  Keyboard,
  KEYBOARD_KEYS
} from "../entities/Keyboard.ts";
import { askFollowUpQuestion } from "../entities/FollowUpManager.ts";
import { handleReferenceAnswer } from "./ena.ts";
import { logError } from "../utils/debugLogger.ts";

const isPersonAlreadyFollowed = (
  person: IPeople,
  followedPeople: { peopleId: Types.ObjectId; lastUpdate: Date }[]
) => {
  return followedPeople.some((followedPerson) => {
    return followedPerson.peopleId.toString() === person._id.toString();
  });
};

const SEARCH_PROMPT_TEXT = `Entrez le nom de la personne à rechercher (ou plusieurs, une par ligne), ou la référence du texte à parcourir.\\split
Exemples:
- *Edouard Philippe*
- *JORFTEXT000052060473*`;

const SEARCH_PROMPT_KEYBOARD: Keyboard = [
  [KEYBOARD_KEYS.PEOPLE_SEARCH_NEW.key],
  [KEYBOARD_KEYS.MAIN_MENU.key]
];

const SEARCH_RESULT_BASE_KEYBOARD: Keyboard = [
  [KEYBOARD_KEYS.PEOPLE_SEARCH_NEW.key],
  [KEYBOARD_KEYS.MAIN_MENU.key]
];

export async function askSearchQuestion(session: ISession): Promise<void> {
  await askFollowUpQuestion(session, SEARCH_PROMPT_TEXT, handleSearchAnswer, {
    messageOptions: {
      keyboard: [[KEYBOARD_KEYS.MAIN_MENU.key]]
    }
  });
}

async function handleSearchAnswer(
  session: ISession,
  answer: string
): Promise<boolean> {
  const trimmedAnswer = answer.trim();

  const multiSearchNames = trimmedAnswer
    .split(/\n+/)
    .map((line) => cleanPeopleName(removeSpecialCharacters(line).trim()))
    .filter((line) => line.length > 0);

  if (multiSearchNames.length > 1) {
    return await handleMultiSearch(session, multiSearchNames);
  }

  if (trimmedAnswer.length === 0) {
    await session.sendMessage(
      `Votre réponse n'a pas été reconnue. 👎\n\nVeuillez essayer de nouveau la commande.`,
      { keyboard: SEARCH_PROMPT_KEYBOARD }
    );
    await askSearchQuestion(session);
    return true;
  }

  if (containsNumber(trimmedAnswer))
    return await handleReferenceAnswer(session, trimmedAnswer);

  switch (trimmedAnswer) {
    case KEYBOARD_KEYS.FOLLOW_UP_FOLLOW.key.text:
    case KEYBOARD_KEYS.FOLLOW_UP_HISTORY.key.text:
    case KEYBOARD_KEYS.FOLLOW_UP_FOLLOW_MANUAL.key.text:
      return false;
  }

  if (trimmedAnswer.startsWith("/")) {
    return false;
  }

  if (trimmedAnswer.split(" ").length < 2) {
    await session.sendMessage(
      "Saisie incorrecte. Veuillez réessayer:\nFormat : *Prénom Nom*",
      { keyboard: SEARCH_PROMPT_KEYBOARD }
    );
    return true;
  }

  await searchPersonHistory(session, "Historique " + trimmedAnswer, "latest");

  return true;
}

interface MultiSearchContext {
  toFollowPeople: { prenom: string; nom: string }[];
  toFollowManual: { nomPrenom: string; display: string }[];
  alreadyFollowedJO: string[];
  alreadyFollowedManual: string[];
}

const MULTI_SEARCH_CONFIRM_KEYBOARD: Keyboard = [
  [{ text: "✅ Confirmer" }],
  [{ text: "❌ Annuler" }],
  [KEYBOARD_KEYS.MAIN_MENU.key]
];

async function handleMultiSearch(
  session: ISession,
  names: string[]
): Promise<boolean> {
  const invalidName = names.find((name) => name.split(" ").length < 2);
  if (invalidName) {
    await session.sendMessage(
      "Saisie incorrecte. Veuillez réessayer:\nFormat : *Prénom Nom* (une personne par ligne)",
      { keyboard: SEARCH_PROMPT_KEYBOARD }
    );
    return true;
  }

  session.user ??= await User.findOrCreate(session);

  const context: MultiSearchContext = {
    toFollowManual: [],
    toFollowPeople: [],
    alreadyFollowedJO: [],
    alreadyFollowedManual: []
  };

  for (const name of names) {
    const splitName = name.split(" ");
    const prenomNom = splitName.join(" ");
    const nomPrenom = `${splitName.slice(1).join(" ")} ${splitName[0]}`;

    const searchResults = await callJORFSearchPeople(
      prenomNom,
      session.messageApp
    );

    const isOnJORF = searchResults != null && searchResults.length > 0;
    let alreadyFollowed = false;

    if (session.user != null) {
      if (isOnJORF) {
        const people = await People.findOne({
          nom: searchResults[0].nom,
          prenom: searchResults[0].prenom
        })
          .collation({ locale: "fr", strength: 2 })
          .lean();

        if (
          people != null &&
          isPersonAlreadyFollowed(people, session.user.followedPeople)
        ) {
          context.alreadyFollowedJO.push(
            `${searchResults[0].prenom} ${searchResults[0].nom}`
          );
          alreadyFollowed = true;
        }
      }

      if (!alreadyFollowed && session.user.checkFollowedName(nomPrenom)) {
        context.alreadyFollowedManual.push(
          isOnJORF
            ? `${searchResults![0].prenom} ${searchResults![0].nom}`
            : prenomNom
        );
        alreadyFollowed = true;
      }
    }

    if (alreadyFollowed) continue;

    if (isOnJORF) {
      context.toFollowPeople.push({
        nom: searchResults![0].nom,
        prenom: searchResults![0].prenom
      });
    } else {
      context.toFollowManual.push({ display: prenomNom, nomPrenom });
    }
  }

  const sections: string[] = [];

  const formatSection = (title: string, items: string[]): string => {
    if (items.length === 0) return `${title}\n- Aucun`;
    return `${title}\n${items.map((item) => `- ${item}`).join("\n")}`;
  };

  sections.push(
    formatSection("Suivis déjà existants", context.alreadyFollowedJO)
  );
  sections.push(
    formatSection(
      "Noms hors JO déjà suivis (suivi manuel)",
      context.alreadyFollowedManual
    )
  );
  sections.push(
    formatSection(
      "Présents sur JORFSearch à ajouter aux suivis",
      context.toFollowPeople.map((p) => `${p.prenom} ${p.nom}`)
    )
  );
  sections.push(
    formatSection(
      "Pas encore sur JO (suivi manuel proposé)",
      context.toFollowManual.map((p) => p.display)
    )
  );

  const text =
    "Plusieurs lignes détectées. L'affichage classique est désactivé.\n\n" +
    sections.join("\n\n") +
    "\n\nConfirmez-vous l'ajout de ces suivis ?\n⚠️ Cela peut créer des suivis groupés (y compris manuels).";

  await askFollowUpQuestion(session, text, handleMultiSearchFollowUp, {
    context,
    messageOptions: { keyboard: MULTI_SEARCH_CONFIRM_KEYBOARD }
  });

  return true;
}

async function handleMultiSearchFollowUp(
  session: ISession,
  answer: string,
  context: MultiSearchContext
): Promise<boolean> {
  const normalizedAnswer = answer.toLowerCase();

  if (normalizedAnswer.includes("confirmer") || normalizedAnswer.includes("oui")) {
    session.user ??= await User.findOrCreate(session);

    const added: string[] = [];
    const manualAdded: string[] = [];

    for (const person of context.toFollowPeople) {
      const people = await People.findOrCreate({
        nom: person.nom,
        prenom: person.prenom
      });
      if (await session.user.addFollowedPeople(people)) {
        added.push(`${person.prenom} ${person.nom}`);
      }
    }

    for (const manual of context.toFollowManual) {
      if (!(session.user?.checkFollowedName(manual.nomPrenom) ?? false)) {
        await session.user?.addFollowedName(manual.nomPrenom);
        manualAdded.push(manual.display);
      }
    }

    const sections: string[] = [];
    const formatSection = (title: string, items: string[]): string => {
      if (items.length === 0) return `${title}\n- Aucun`;
      return `${title}\n${items.map((item) => `- ${item}`).join("\n")}`;
    };

    sections.push(formatSection("Suivis ajoutés", added));
    sections.push(formatSection("Suivis manuels ajoutés", manualAdded));

    await session.sendMessage(sections.join("\n\n"), {
      keyboard: SEARCH_PROMPT_KEYBOARD
    });
    return true;
  }

  if (normalizedAnswer.includes("annuler") || normalizedAnswer.includes("non")) {
    await session.sendMessage("Ajout groupé annulé.", {
      keyboard: SEARCH_PROMPT_KEYBOARD
    });
    return true;
  }

  await session.sendMessage(
    "Réponse non reconnue. Merci de confirmer ou annuler.",
    { keyboard: MULTI_SEARCH_CONFIRM_KEYBOARD }
  );

  return true;
}

export const searchCommand = async (session: ISession): Promise<void> => {
  session.log({ event: "/search" });
  await askSearchQuestion(session);
};

export const fullHistoryCommand = async (
  session: ISession,
  msg?: string
): Promise<void> => {
  session.log({ event: "/history" });

  if (msg == undefined) {
    await logError("Telegram", "/history command called without msg argument");
    return;
  }

  const personName = msg.split(" ").slice(1).join(" ");

  if (personName.length == 0) {
    await session.sendMessage(
      "Saisie incorrecte. Veuillez réessayer:\nFormat : *Rechercher Prénom Nom*",
      { keyboard: SEARCH_PROMPT_KEYBOARD }
    );
    return;
  }
  await searchPersonHistory(session, "Historique " + personName, "full");
};

// returns whether the person exists
export async function searchPersonHistory(
  session: ISession,
  message: string,
  historyType: "full" | "latest" = "latest",
  noSearch = false,
  fromFollow = false
): Promise<void> {
  try {
    const personName = message.split(" ").slice(1).join(" ");

    let JORFRes_data: JORFSearchItem[] | null = [];
    if (!noSearch)
      JORFRes_data = await callJORFSearchPeople(personName, session.messageApp);
    const nbRecords = JORFRes_data?.length ?? 0;

    if (nbRecords == 0 || JORFRes_data == null) {
      const tempKeyboard: Keyboard = cloneKeyboard(SEARCH_RESULT_BASE_KEYBOARD);

      const personNameSplit = personName.split(" ");
      if (personNameSplit.length < 2) {
        // Minimum is two words: Prénom + Nom
        await session.sendMessage(
          "Saisie incorrecte. Veuillez réessayer:\nFormat : *Rechercher Prénom Nom*",
          { keyboard: tempKeyboard }
        );
        return;
      }
      const prenomNom = personNameSplit.join(" ");
      const nomPrenom = `${personNameSplit.slice(1).join(" ")} ${personNameSplit[0]}`;

      if (session.user?.checkFollowedName(nomPrenom)) {
        const text = `Vous suivez manuellement *${prenomNom}* ✅`;
        await session.sendMessage(text);
        return;
      }

      let text: string;
      if (JORFRes_data == null) {
        text =
          "Une erreur JORFSearch indépendante de JOEL est survenue. Veuillez réessayer ultérieurement:\n\nVous pouvez utiliser le bouton ci-dessous pour forcer un suivi manuel.";
      } else {
        text = `*${personName}* est introuvable au JO !\n\nAssurez vous d'avoir bien tapé le prénom et le nom correctement !\\splitSi votre saisie est correcte, il est possible que la personne ne soit pas encore apparue au JO.\n\nUtilisez le bouton ci-dessous pour forcer le suivi sur les nominations à venir.`;
      }

      tempKeyboard.unshift([KEYBOARD_KEYS.FOLLOW_UP_FOLLOW_MANUAL.key]);

      await askFollowUpQuestion(session, text, handleSearchFollowUp, {
        context: {
          prenomNom,
          JORFOffline: JORFRes_data == null
        },
        messageOptions: {
          keyboard: tempKeyboard
        }
      });
      return;
    }
    const tempKeyboard: Keyboard = [];

    let peopleFromDB: IPeople | null = null;

    const nomPrenom = JORFRes_data[0].nom + " " + JORFRes_data[0].prenom;
    const prenomNom = JORFRes_data[0].prenom + " " + JORFRes_data[0].nom;

    // Transform manual follow into strong follow
    if (session.user?.checkFollowedName(nomPrenom)) {
      const text = `Vous suivez manuellement *${prenomNom}* ✅`;
      await session.sendMessage(text);

      peopleFromDB = await People.findOrCreate({
        nom: JORFRes_data[0].nom,
        prenom: JORFRes_data[0].prenom
      });
      await session.user.addFollowedPeople(peopleFromDB);
      await session.user.removeFollowedName(nomPrenom);

      await session.sendMessage(
        `*${prenomNom}* a été ajouté vos suivis manuels`,
        { forceNoKeyboard: true }
      );
    }
    let numberFollowers: number | undefined;

    peopleFromDB ??= await People.findOne({
      nom: JORFRes_data[0].nom,
      prenom: JORFRes_data[0].prenom
    });
    if (peopleFromDB != null) {
      numberFollowers = await User.countDocuments({
        followedPeople: { $elemMatch: { peopleId: peopleFromDB._id } }
      });
    }

    let text = "";
    if (historyType === "latest") {
      text += formatSearchResult(
        JORFRes_data.slice(0, 2),
        session.messageApp !== "WhatsApp",
        {
          isConfirmation: true,
          numberUserFollowing: numberFollowers
        }
      );
    } else {
      text += formatSearchResult(
        JORFRes_data,
        session.messageApp !== "WhatsApp",
        {
          numberUserFollowing: numberFollowers
        }
      );
    }

    // Check if the user has an account and follows the person
    let isUserFollowingPerson: boolean | null;
    if (session.user == null) {
      isUserFollowingPerson = false;
    } else {
      const people: IPeople | null = await People.findOne({
        nom: JORFRes_data[0].nom,
        prenom: JORFRes_data[0].prenom
      })
        .collation({ locale: "fr", strength: 2 }) // case-insensitive, no regex
        .lean();

      isUserFollowingPerson = !(
        people === null ||
        !isPersonAlreadyFollowed(people, session.user.followedPeople)
      );
    }

    if (nbRecords > 2 || !isUserFollowingPerson) {
      if (historyType === "latest" && nbRecords > 2) {
        text += `\n${String(nbRecords - 2)} autres mentions au JORF non affichées.\n`;
        if (session.messageApp === "Signal")
          text += `\nPour voir l'historique complet, utilisez la commande: *Historique ${prenomNom}*.\n`;

        tempKeyboard.push([KEYBOARD_KEYS.FOLLOW_UP_HISTORY.key]);
      }
      if (!isUserFollowingPerson) {
        tempKeyboard.unshift([KEYBOARD_KEYS.FOLLOW_UP_FOLLOW.key]);
      }
    }

    if (!fromFollow) {
      if (isUserFollowingPerson) {
        text += `\nVous suivez *${prenomNom}* ✅`;
      } else {
        text += `\nVous ne suivez pas *${prenomNom}* 🙅‍♂️\n\n`;
        if (session.messageApp === "Signal")
          text += `Pour suivre, utilisez la commande:\n*Suivre ${prenomNom}*`;
      }
    }
    if (tempKeyboard.length < 2)
      tempKeyboard.push([KEYBOARD_KEYS.PEOPLE_SEARCH_NEW.key]);
    tempKeyboard.push([KEYBOARD_KEYS.MAIN_MENU.key]);

    await askFollowUpQuestion(session, text, handleSearchFollowUp, {
      context: {
        prenomNom
      },
      messageOptions: {
        keyboard: tempKeyboard
      }
    });

    return;
  } catch (error) {
    await logError(session.messageApp, "Error in search command", error);
  }
  return;
}

interface SearchFollowUpContext {
  prenomNom: string;
  JORFOffline?: boolean;
}

async function handleSearchFollowUp(
  session: ISession,
  answer: string,
  context: SearchFollowUpContext
): Promise<boolean> {
  const trimmedAnswer = answer.trim();

  switch (trimmedAnswer) {
    case KEYBOARD_KEYS.FOLLOW_UP_FOLLOW.key.text:
      await followCommand(session, "Suivre " + context.prenomNom);
      return true;
    case KEYBOARD_KEYS.FOLLOW_UP_HISTORY.key.text:
      await searchPersonHistory(
        session,
        "Historique " + context.prenomNom,
        "full"
      );
      return true;
    case KEYBOARD_KEYS.FOLLOW_UP_FOLLOW_MANUAL.key.text:
      await manualFollowCommand(session, "SuivreN " + context.prenomNom);
      return true;
  }
  return false;
}

export const followCommand = async (
  session: ISession,
  msg: string
): Promise<void> => {
  try {
    session.log({ event: "/follow" });

    const msgSplit = msg.split(" ");

    if (msgSplit.length < 3) {
      await session.sendMessage(
        "Saisie incorrecte. Veuillez réessayer:\nFormat : *Suivre Prénom Nom*"
      );
      return;
    }

    const personName = msgSplit.slice(1).join(" ");

    const JORFRes = await callJORFSearchPeople(personName, session.messageApp);
    if (JORFRes == null || JORFRes.length == 0) {
      // redirect to manual follow
      await searchPersonHistory(
        session,
        "Historique " + personName,
        "latest",
        false,
        true
      );
      return;
    }

    session.user ??= await User.findOrCreate(session);

    const people = await People.findOrCreate({
      nom: JORFRes[0].nom,
      prenom: JORFRes[0].prenom
    });

    let text = "";
    if (await session.user.addFollowedPeople(people)) {
      text += `Vous suivez maintenant *${JORFRes[0].prenom} ${JORFRes[0].nom}* ✅`;
    } else {
      // With the search/follow flow this would happen only if the user types the "Suivre **" manually
      text += `Vous suivez déjà *${JORFRes[0].prenom} ${JORFRes[0].nom}* ✅`;
    }

    await session.sendMessage(text, { keyboard: SEARCH_PROMPT_KEYBOARD });
  } catch (error) {
    await logError(session.messageApp, "Error in /search command", error);
  }
};
export const manualFollowCommand = async (
  session: ISession,
  msg?: string
): Promise<void> => {
  session.log({ event: "/follow-name" });

  const personNameSplit = cleanPeopleName(
    removeSpecialCharacters(msg ?? "")
      .trim()
      .replaceAll("  ", " ")
  )
    .split(" ")
    .slice(1);

  if (personNameSplit.length < 2) {
    await session.sendMessage(
      "Saisie incorrecte. Veuillez réessayer:\nFormat : *SuivreN Prénom Nom*"
    );
    return;
  }

  const prenomNom = personNameSplit.join(" ");
  const nomPrenom = `${personNameSplit.slice(1).join(" ")} ${personNameSplit[0]}`;

  const JORFResult = await callJORFSearchPeople(prenomNom, session.messageApp);
  if (JORFResult == null) {
    await session.sendMessage(
      "Une erreur JORFSearch indépendante de JOEL est survenue. Veuillez réessayer ultérieurement."
    );
    return;
  }
  if (JORFResult.length > 0) {
    await followCommand(session, "Suivre " + prenomNom);
    return;
  }

  if (session.user?.checkFollowedName(nomPrenom)) {
    await session.sendMessage(
      `Vous suivez déjà *${prenomNom}* (ou orthographe alternative prise en compte) ✅`
    );
    return;
  }

  session.user = await User.findOrCreate(session);
  await session.user.addFollowedName(nomPrenom);

  await session.sendMessage(
    `Le suivi manuel a été ajouté à votre profil en tant que *${nomPrenom}* ✅`
  );
};
