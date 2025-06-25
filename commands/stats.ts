import Users from "../models/User.js";
import People from "../models/People.js";
import { ISession } from "../types.js";
import { mainMenuKeyboard } from "../utils/keyboards.js";

export const statsCommand = async (session: ISession, _msg: never): Promise<void> => {
  try {
    await session.log({ event: "/stats" });
    const usersCount = await Users.countDocuments();
    const peopleCount = await People.countDocuments();

      await session.sendMessage(
        `📈 JOEL aujourd’hui c’est\n👨‍💻 ${usersCount} utilisateurs\n🕵️ ${peopleCount} personnes suivies\n\nJOEL sait combien vous êtes à l'utiliser mais il ne sait pas qui vous êtes... et il ne cherchera jamais à le savoir! 🛡`,
        mainMenuKeyboard
      );
  } catch (error) {
    console.log(error);
  }
};
