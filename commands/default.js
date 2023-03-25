const { startKeyboard } = require('../utils/keyboards')

module.exports = (bot) => async (msg) => {
	try {
		// only answer to messages are not replies
		if (!msg.reply_to_message) {
			await bot.sendMessage(
				msg.chat.id,
				`Je n'ai pas compris votre message 🥺\nMerci d'utiliser un des boutons ci-dessous pour interagir avec moi.`,
				startKeyboard
			)
		}
	} catch (error) {
		console.log(error)
	}
}
