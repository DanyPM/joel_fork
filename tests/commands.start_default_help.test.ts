import { jest } from "@jest/globals";

describe("start, default and help commands", () => {
  const createSession = (overrides: Record<string, unknown> = {}) => ({
    messageApp: "Telegram",
    chatId: 42,
    language_code: "fr",
    user: undefined,
    isReply: false,
    loadUser: jest.fn(),
    createUser: jest.fn(),
    sendMessage: jest.fn(),
    sendTypingAction: jest.fn(),
    log: jest.fn(),
    ...overrides
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("sends help and logs /start for plain greetings", async () => {
    const processMessage = jest.fn();
    jest.unstable_mockModule("../commands/Commands.ts", () => ({
      processMessage
    }));

    const getHelpText = jest.fn().mockReturnValue("help text");
    jest.unstable_mockModule("../commands/help.ts", () => ({
      getHelpText,
      helpCommand: jest.fn(),
      buildInfoCommand: jest.fn()
    }));

    const { startCommand } = await import("../commands/start.ts");
    const session = createSession();

    await startCommand(session, "/start");

    expect(session.sendTypingAction).toHaveBeenCalled();
    expect(getHelpText).toHaveBeenCalledWith(session);
    expect(session.sendMessage).toHaveBeenCalledWith("help text", {
      separateMenuMessage: true
    });
    expect(session.log).toHaveBeenCalledWith({ event: "/start" });
    expect(processMessage).not.toHaveBeenCalled();
  });

  it("dispatches inline commands and logs contextual events", async () => {
    const processMessage = jest.fn();
    jest.unstable_mockModule("../commands/Commands.ts", () => ({
      processMessage
    }));

    const getHelpText = jest.fn().mockReturnValue("help inline");
    jest.unstable_mockModule("../commands/help.ts", () => ({
      getHelpText,
      helpCommand: jest.fn(),
      buildInfoCommand: jest.fn()
    }));

    const { startCommand } = await import("../commands/start.ts");
    const session = createSession();

    await startCommand(session, "/start SuivreO Q42");

    expect(session.sendMessage).toHaveBeenCalledWith("help inline", {
      forceNoKeyboard: true
    });
    expect(session.log).toHaveBeenCalledWith({
      event: "/start-from-organisation"
    });
    expect(processMessage).toHaveBeenCalledWith(session, "SuivreO Q42");

    jest.clearAllMocks();

    await startCommand(session, "/start SuivreF R01");
    expect(session.log).toHaveBeenCalledWith({ event: "/start-from-tag" });
    expect(processMessage).toHaveBeenLastCalledWith(session, "SuivreF R01");

    jest.clearAllMocks();

    await startCommand(session, "Bonjour JOEL ! Rechercher Marie Curie");
    expect(session.log).toHaveBeenCalledWith({ event: "/start-from-people" });
    expect(processMessage).toHaveBeenLastCalledWith(
      session,
      "Rechercher Marie Curie"
    );
  });

  it("returns gracefully when no additional command is supplied", async () => {
    const processMessage = jest.fn();
    jest.unstable_mockModule("../commands/Commands.ts", () => ({
      processMessage
    }));

    const getHelpText = jest.fn().mockReturnValue("help");
    jest.unstable_mockModule("../commands/help.ts", () => ({
      getHelpText,
      helpCommand: jest.fn(),
      buildInfoCommand: jest.fn()
    }));

    const { startCommand } = await import("../commands/start.ts");
    const session = createSession();

    await expect(startCommand(session, "Bonjour JOEL"))
      .resolves.toBeUndefined();
    expect(processMessage).not.toHaveBeenCalled();
  });

  it("sends fallback messaging and logging for defaultCommand", async () => {
    const { defaultCommand } = await import("../commands/default.ts");
    const session = createSession();

    await defaultCommand(session);

    expect(session.log).toHaveBeenCalledWith({ event: "/default-message" });
    expect(session.sendMessage).toHaveBeenCalledWith(
      "Je n'ai pas compris votre message 🥺",
      { separateMenuMessage: true }
    );
  });

  it("skips fallback messaging when handling replies", async () => {
    const { defaultCommand } = await import("../commands/default.ts");
    const session = createSession({ isReply: true });

    await defaultCommand(session);

    expect(session.log).not.toHaveBeenCalled();
    expect(session.sendMessage).not.toHaveBeenCalled();
  });

  it("logs main menu requests and delegates to sendMainMenu", async () => {
    const module = await import("../commands/default.ts");
    const spy = jest
      .spyOn(module, "sendMainMenu")
      .mockResolvedValue(undefined as never);

    const session = createSession({ messageApp: "Signal" });
    await module.mainMenuCommand(session as any);

    expect(session.log).toHaveBeenCalledWith({ event: "/main-menu-message" });
    expect(spy).toHaveBeenCalledWith("Signal", 42, { session });
  });

  it("renders help differently for Telegram and other apps", async () => {
    const module = await import("../commands/help.ts");

    const telegramSession = createSession({ messageApp: "Telegram" });
    await module.helpCommand(telegramSession);

    expect(telegramSession.log).toHaveBeenCalledWith({ event: "/help" });
    expect(telegramSession.sendTypingAction).toHaveBeenCalled();
    const telegramHelp = (telegramSession.sendMessage as jest.Mock).mock.calls[0][0];
    expect(telegramHelp).toContain("/export");
    expect(telegramHelp).toContain("/supprimerCompte");
    expect((telegramSession.sendMessage as jest.Mock).mock.calls[0][1]).toEqual({
      separateMenuMessage: true
    });

    const signalSession = createSession({ messageApp: "Signal" });
    await module.helpCommand(signalSession);
    const signalHelp = (signalSession.sendMessage as jest.Mock).mock.calls[0][0];
    expect(signalHelp).toContain("*Exporter*");
    expect(signalHelp).not.toContain("/supprimerCompte");
  });

  it("builds help text by replacing placeholders", async () => {
    const { getHelpText } = await import("../commands/help.ts");
    const session = createSession({ chatId: 77, messageApp: "WhatsApp" });

    const help = getHelpText(session);

    expect(help).toContain(String(session.chatId));
    expect(help).toContain(session.messageApp);
    expect(help).toContain("Politique de confidentialité");
    expect(help).toContain("Conditions générales d'utilisation");
    expect(help).toContain("Rejoignez notre channel officiel");
    expect(help).not.toContain("{CHAT_ID}");
    expect(help).not.toContain("{MESSAGE_APP}");
  });

  it("sends blank informational messages via buildInfoCommand", async () => {
    const { buildInfoCommand } = await import("../commands/help.ts");
    const session = createSession();

    await buildInfoCommand(session);

    expect(session.sendMessage).toHaveBeenCalledWith("", {
      separateMenuMessage: true
    });
  });
});
