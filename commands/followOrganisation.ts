import { startKeyboard } from "../utils/keyboards";
import get from "axios";
import umami from "../utils/umami";
import TelegramBot from "node-telegram-bot-api";
import {
    JORFSearchItem,
    JORFSearchResponse,
} from "../entities/JORFSearchResponse";
import Organisation from "../models/Organisation";
import User from "../models/User";
import { IOrganisation, IUser } from "../types";

const isOrganisationAlreadyFollowed = (
    user: IUser,
    organisation: IOrganisation,
) => {
    return user.followedOrganisations.some(
        (o) => o.wikidata_id === organisation.wikidata_id,
    );
};

async function getJORFOrganisationResult(
    wikidata_id: string,
): Promise<JORFSearchItem[] | null> {
    return await get<JORFSearchResponse>(
        encodeURI(
            `https://jorfsearch.steinertriples.ch/${wikidata_id.toUpperCase()}?format=JSON`,
        ),
    ).then((res) => {
        if (typeof res.data === "string") {
            return null;
        }
        return res.data;
    });
}

export const followOrganisationCommand =
    (bot: TelegramBot) => async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        await umami.log({ event: "/follow-organisation" });
        try {
            await bot.sendChatAction(chatId, "typing");
            const question = await bot.sendMessage(
                chatId,
                `Entrez l'identifiant wikidata de l'organisation que vous souhaitez suivre:
Exemples:
Conseil d'Etat : *Q769657*
Conseil constitutionnel : *Q1127218*\n
💡 [Cliquez ici](https://www.steinertriples.ch/ncohen/data/nominations_JORF/) pour rechercher l'organisation et reportez l'identifiant dans l'URL de résultats.`,
                {
                    parse_mode: "Markdown",
                    reply_markup: {
                        force_reply: true,
                    },
                },
            );
            bot.onReplyToMessage(chatId, question.message_id, async (msg) => {
                if (msg.text === undefined || msg.text === "") {
                    await bot.sendMessage(
                        chatId,
                        `Votre réponse n'a pas été reconnue. 👎 Veuillez essayer de nouveau la commande /followOrganisation.`,
                    );
                    return;
                }

                const JORFRes = await getJORFOrganisationResult(msg.text);

                if (
                    JORFRes === null ||
                    JORFRes.length === 0 ||
                    JORFRes[0].organisations.length === 0 ||
                    JORFRes[0].organisations[0].wikidata_id === undefined
                ) {
                    await bot.sendMessage(
                        chatId,
                        "Organisation introuvable, assurez vous d'avoir saisi un identifiant wikidata correct. 👎 Veuillez essayer de nouveau la commande /ena.",
                        startKeyboard,
                    );
                    return;
                }

                const organisation: IOrganisation = await Organisation.firstOrCreate({
                    nom: JORFRes[0].organisations[0].nom,
                    wikidata_id: JORFRes[0].organisations[0].wikidata_id,
                });

                const user = await User.firstOrCreate({ tgUser: msg.from, chatId });

                if (!isOrganisationAlreadyFollowed(user, organisation)) {
                    user.followedOrganisations.push({
                        wikidata_id: organisation.wikidata_id,
                        lastUpdate: new Date(Date.now()),
                    });
                    await user.save();
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    await bot.sendMessage(
                        chatId,
                        `Vous suivez maintenant *${organisation.nom}* ✅`,
                        startKeyboard,
                    );
                } else {
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    await bot.sendMessage(
                        chatId,
                        `Vous suivez déjà *${organisation.nom}* ✅`,
                        startKeyboard,
                    );
                }
            });
        } catch (error) {
            console.log(error);
        }
    };
