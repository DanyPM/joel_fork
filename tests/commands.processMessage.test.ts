import { jest } from "@jest/globals";

describe("processMessage", () => {
  const baseSession = (overrides: Partial<ReturnType<typeof defaultSession>> = {}) => ({
    ...defaultSession(),
    ...overrides
  });

  const defaultSession = () => ({
    messageApp: "Telegram" as const,
    chatId: 123,
    language_code: "fr",
    user: undefined,
    isReply: false,
    loadUser: jest.fn(),
    createUser: jest.fn(),
    sendMessage: jest.fn(),
    sendTypingAction: jest.fn(),
    log: jest.fn()
  });

  const registerSharedMocks = () => {
    const noop = jest.fn().mockResolvedValue(undefined);

    jest.unstable_mockModule("../commands/followOrganisation.ts", () => ({
      searchOrganisation: noop,
      searchOrganisationFromStr: noop,
      followOrganisationsFromWikidataIdStr: noop
    }));
    jest.unstable_mockModule("../commands/search.ts", () => ({
      followCommand: jest.fn().mockResolvedValue(undefined),
      fullHistoryCommand: noop,
      manualFollowCommand: noop,
      searchCommand: jest.fn().mockResolvedValue(undefined),
      searchPersonHistory: jest.fn().mockResolvedValue(undefined)
    }));
    jest.unstable_mockModule("../commands/ena.ts", () => ({
      enaCommand: noop,
      promosCommand: noop,
      suivreFromJOReference: noop
    }));
    jest.unstable_mockModule("../commands/stats.ts", () => ({
      statsCommand: noop
    }));
    jest.unstable_mockModule("../commands/deleteProfile.ts", () => ({
      deleteProfileCommand: noop
    }));
    jest.unstable_mockModule("../commands/followFunction.ts", () => ({
      followFunctionCommand: noop,
      followFunctionFromStrCommand: noop
    }));
    jest.unstable_mockModule("../commands/list.ts", () => ({
      listCommand: noop,
      unfollowFromStr: noop
    }));
    jest.unstable_mockModule("../commands/help.ts", () => ({
      buildInfoCommand: noop
    }));
    jest.unstable_mockModule("../commands/importExport.ts", () => ({
      exportCommand: noop,
      importCommand: noop
    }));
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("normalises whitespace before routing to command handlers", async () => {
    registerSharedMocks();
    const session = defaultSession();

    const searchCommand = jest.fn().mockResolvedValue(undefined);
    const followCommand = jest.fn().mockResolvedValue(undefined);
    jest.unstable_mockModule("../commands/search.ts", () => ({
      followCommand,
      fullHistoryCommand: jest.fn(),
      manualFollowCommand: jest.fn(),
      searchCommand,
      searchPersonHistory: jest.fn().mockResolvedValue(undefined)
    }));

    const defaultCommand = jest.fn();
    jest.unstable_mockModule("../commands/default.ts", () => ({
      defaultCommand,
      MAIN_MENU_MESSAGE: "",
      mainMenuCommand: jest.fn(),
      sendMainMenu: jest.fn()
    }));

    jest.unstable_mockModule("../commands/start.ts", () => ({
      startCommand: jest.fn()
    }));

    jest.unstable_mockModule("../entities/Keyboard.ts", () => ({
      KEYBOARD_KEYS: {}
    }));

    const handleFollowUpMessage = jest
      .fn()
      .mockResolvedValue(false);
    const clearFollowUp = jest.fn();
    jest.unstable_mockModule("../entities/FollowUpManager.ts", () => ({
      handleFollowUpMessage,
      clearFollowUp
    }));

    const { processMessage } = await import("../commands/Commands.ts");

    await processMessage(session, "   Rechercher   Alice    Martin   ");

    expect(searchCommand).toHaveBeenCalledWith(
      session,
      "Rechercher Alice Martin"
    );
    expect(followCommand).not.toHaveBeenCalled();
    expect(defaultCommand).not.toHaveBeenCalled();
  });

  it("invokes keyboard actions before command matching and clears follow-ups", async () => {
    registerSharedMocks();
    const session = defaultSession();

    const keyboardAction = jest.fn().mockResolvedValue(undefined);
    jest.unstable_mockModule("../entities/Keyboard.ts", () => ({
      KEYBOARD_KEYS: {
        TEST: { key: { text: "Button" }, action: keyboardAction }
      }
    }));

    const defaultCommand = jest.fn();
    jest.unstable_mockModule("../commands/default.ts", () => ({
      defaultCommand,
      MAIN_MENU_MESSAGE: "",
      mainMenuCommand: jest.fn(),
      sendMainMenu: jest.fn()
    }));

    jest.unstable_mockModule("../commands/start.ts", () => ({
      startCommand: jest.fn()
    }));

    const handleFollowUpMessage = jest
      .fn()
      .mockResolvedValue(false);
    const clearFollowUp = jest.fn();
    jest.unstable_mockModule("../entities/FollowUpManager.ts", () => ({
      handleFollowUpMessage,
      clearFollowUp
    }));

    const { processMessage } = await import("../commands/Commands.ts");

    await processMessage(session, "Button\nignored");

    expect(clearFollowUp).toHaveBeenCalledWith(session);
    expect(keyboardAction).toHaveBeenCalledWith(session, "Button\nignored");
    expect(handleFollowUpMessage).not.toHaveBeenCalled();
    expect(defaultCommand).not.toHaveBeenCalled();
  });

  it("delegates to follow-up handlers and stops processing when they resolve", async () => {
    registerSharedMocks();
    const session = defaultSession();

    jest.unstable_mockModule("../entities/Keyboard.ts", () => ({
      KEYBOARD_KEYS: {}
    }));

    const defaultCommand = jest.fn();
    jest.unstable_mockModule("../commands/default.ts", () => ({
      defaultCommand,
      MAIN_MENU_MESSAGE: "",
      mainMenuCommand: jest.fn(),
      sendMainMenu: jest.fn()
    }));

    jest.unstable_mockModule("../commands/start.ts", () => ({
      startCommand: jest.fn()
    }));

    const clearFollowUp = jest.fn();
    const handleFollowUpMessage = jest
      .fn()
      .mockImplementation(async () => {
        clearFollowUp(session);
        return true;
      });
    jest.unstable_mockModule("../entities/FollowUpManager.ts", () => ({
      handleFollowUpMessage,
      clearFollowUp
    }));

    const { processMessage } = await import("../commands/Commands.ts");

    await processMessage(session, "manual follow-up response");

    expect(handleFollowUpMessage).toHaveBeenCalledWith(
      session,
      "manual follow-up response"
    );
    expect(defaultCommand).not.toHaveBeenCalled();
  });

  it("routes regex matches to the correct command handler", async () => {
    registerSharedMocks();
    const session = defaultSession();

    const followCommand = jest.fn().mockResolvedValue(undefined);
    jest.unstable_mockModule("../commands/search.ts", () => ({
      followCommand,
      fullHistoryCommand: jest.fn(),
      manualFollowCommand: jest.fn(),
      searchCommand: jest.fn(),
      searchPersonHistory: jest.fn().mockResolvedValue(undefined)
    }));

    const defaultCommand = jest.fn();
    jest.unstable_mockModule("../commands/default.ts", () => ({
      defaultCommand,
      MAIN_MENU_MESSAGE: "",
      mainMenuCommand: jest.fn(),
      sendMainMenu: jest.fn()
    }));

    jest.unstable_mockModule("../commands/start.ts", () => ({
      startCommand: jest.fn()
    }));

    jest.unstable_mockModule("../entities/Keyboard.ts", () => ({
      KEYBOARD_KEYS: {}
    }));

    const handleFollowUpMessage = jest
      .fn()
      .mockResolvedValue(false);
    const clearFollowUp = jest.fn();
    jest.unstable_mockModule("../entities/FollowUpManager.ts", () => ({
      handleFollowUpMessage,
      clearFollowUp
    }));

    const { processMessage } = await import("../commands/Commands.ts");

    await processMessage(session, "Suivre Marie Curie");

    expect(followCommand).toHaveBeenCalledWith(
      session,
      "Suivre Marie Curie"
    );
    expect(defaultCommand).not.toHaveBeenCalled();
  });

  it("falls back to default command when nothing matches", async () => {
    registerSharedMocks();
    const session = defaultSession();

    jest.unstable_mockModule("../entities/Keyboard.ts", () => ({
      KEYBOARD_KEYS: {}
    }));

    const defaultCommand = jest.fn();
    jest.unstable_mockModule("../commands/default.ts", () => ({
      defaultCommand,
      MAIN_MENU_MESSAGE: "",
      mainMenuCommand: jest.fn(),
      sendMainMenu: jest.fn()
    }));

    jest.unstable_mockModule("../commands/start.ts", () => ({
      startCommand: jest.fn()
    }));

    const handleFollowUpMessage = jest
      .fn()
      .mockResolvedValue(false);
    const clearFollowUp = jest.fn();
    jest.unstable_mockModule("../entities/FollowUpManager.ts", () => ({
      handleFollowUpMessage,
      clearFollowUp
    }));

    const { processMessage } = await import("../commands/Commands.ts");

    await processMessage(session, "something else");

    expect(defaultCommand).toHaveBeenCalledWith(session);
  });

  it("does not send fallback content when processing reply messages", async () => {
    registerSharedMocks();
    const session = baseSession({ isReply: true });

    jest.unstable_mockModule("../entities/Keyboard.ts", () => ({
      KEYBOARD_KEYS: {}
    }));

    const defaultCommand = jest.fn(async (sess) => {
      if (sess.isReply) return;
      await sess.sendMessage("fallback");
    });
    jest.unstable_mockModule("../commands/default.ts", () => ({
      defaultCommand,
      MAIN_MENU_MESSAGE: "",
      mainMenuCommand: jest.fn(),
      sendMainMenu: jest.fn()
    }));

    jest.unstable_mockModule("../commands/start.ts", () => ({
      startCommand: jest.fn()
    }));

    const handleFollowUpMessage = jest
      .fn()
      .mockResolvedValue(false);
    const clearFollowUp = jest.fn();
    jest.unstable_mockModule("../entities/FollowUpManager.ts", () => ({
      handleFollowUpMessage,
      clearFollowUp
    }));

    const { processMessage } = await import("../commands/Commands.ts");

    await processMessage(session, "irrelevant");

    expect(defaultCommand).toHaveBeenCalled();
    expect(session.sendMessage).not.toHaveBeenCalled();
  });
});
