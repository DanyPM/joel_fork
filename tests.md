# Proposed Test Suite

Below is the recommended automated test coverage for the repository (excluding the current `tests/` directory). Each section corresponds to a future test file and lists the scenarios that should be validated.

## commands/processMessage.test.ts
- Verify that whitespace normalization is applied before command routing and that leading/trailing whitespace does not affect matching.
- Confirm that pressing a keyboard key triggers the associated action, clears pending follow-ups, and stops command matching.
- Ensure that when `handleFollowUpMessage` resolves a message, `processMessage` halts further processing and follow-up state is cleared.
- Validate that messages matching registered command regex patterns invoke the proper command handler with the original message.
- Confirm that unmatched messages fall back to `defaultCommand` and that reply messages bypass the fallback when `session.isReply` is true.

## commands/start_default_help.test.ts
- Validate `/start` behavior with pure greetings, ensuring help text is sent with menu separation and that the `/start` event is logged.
- Cover `/start` + inline command variants (follow, search, organisation, function) verifying secondary command dispatch and event-specific logging (`/start-from-*`).
- Check that `startCommand` returns gracefully when invoked without additional message content.
- Test `defaultCommand` responses, ensuring reply messages do not emit fallback content and that logging occurs.
- Ensure `mainMenuCommand` logs `/main-menu-message` and delegates to `sendMainMenu` with proper arguments.
- Confirm `helpCommand` augmentations differ between Telegram and other apps (extra export/delete hints) and that help text tokens are replaced correctly via `getHelpText`.
- Validate `buildInfoCommand` sends a blank informational message respecting `separateMenuMessage`.

## commands/search_follow.test.ts
- Cover `searchCommand` follow-up prompting, including keyboard content and logging.
- Exercise `handleSearchAnswer` for empty messages, slash-prefixed commands, single-word inputs, and successful searches, ensuring re-prompts and follow-up continuation semantics.
- Simulate successful `searchPersonHistory` calls, checking keyboard construction (follow, history, manual follow options) based on record count, existing follows, and message app.
- Verify manual follow fallback when JORF has zero results, including detection of existing manual follows and follow-up chaining to manual follow actions.
- Test `fullHistoryCommand` error responses for missing name, ensuring the keyboard matches search prompts.
- Validate `followCommand` behaviors for new vs. existing follows, manual follow fallback when API returns empty, and duplicate prevention.
- Ensure `manualFollowCommand` handles incorrect input, redirects to `followCommand` when JORF matches, avoids duplicates via `checkFollowedName`, and adds cleaned names for manual follow entries.
- Confirm follow-up handlers (`handleSearchFollowUp`) dispatch to appropriate commands based on button text and ignore unrelated replies.

## commands/list_unfollow.test.ts
- Validate `getAllUserFollowsOrdered` aggregation: sorting functions alphabetically, organisations lexicographically, manual vs. database people merge, and generated JORF links.
- Ensure `buildFollowsListMessage` formats message variants (Telegram vs. WhatsApp link formatting, perspective changes, pluralization, manual follow tagging) and returns empty string when no entries exist.
- Test `listCommand` behavior when session has no user, empty follow list, and populated data—verifying keyboard layout, Signal-specific extra guidance, and typing indicators.
- Cover `unfollowCommand` prompting with proper keyboard, re-asking follow-up on empty answers, and verifying log emission.
- Exercise `unfollowFromStr` for invalid selections (out-of-range, duplicates, non-numeric), mixed removals across functions/organisations/people/manual names, user deletion when nothing remains, and optional Umami logging toggle.
- Confirm follow-up flows respect message app differences (Telegram keyboard vs. plain text).

## commands/followOrganisation.test.ts
- Validate search follow-up prompts, ensuring re-prompts on empty answers and command bypass when user sends a slash command.
- Mock Wikidata search responses to cover zero, single, and multiple organisation results, verifying JORF link formatting and keyboard adjustments per message app.
- Ensure follow-up confirmation adds organisations to the user, handles duplicates, and persists new organisation records via `Organisation.findOrCreate`.
- Check numeric selection parsing for multi-result confirmations, including invalid selections, duplicate entries, and combined follow-ups.
- Verify Umami logging triggers for search and follow actions.

## commands/followFunction.test.ts
- Test formatted function list generation highlighting already-followed tags and respecting session user state.
- Cover follow-up prompt handling for empty inputs, command interruptions, numeric vs. textual selections, and mixed casing/hyphen variations.
- Ensure duplicates are eliminated by `parseFunctionSelection` and that `followFunctionsCommand` differentiates between newly added and already-followed tags in the confirmation message.
- Validate direct command invocation via `followFunctionFromStrCommand`, including fallback to list prompt when no argument provided and rejection messaging for unknown tags.

## commands/ena_promos.test.ts
- Validate promo lookup (`findENAINSPPromo`) for exact names, period formats, hyphen/diacritic variations, and absent promos.
- Cover follow-up prompts for promo entry: empty input handling, unavailable promos (`onJORF=false`), invalid promos with Signal-specific hints, and successful retrieval messaging with sorted contact list.
- Test confirmation follow-up for affirmative, negative, and unrecognized responses, ensuring duplicates are skipped and People records are created/updated.
- Verify follow-up flows for JO reference tracking (`suivreFromJOReference`) and JORF text extraction (if defined in `ena.ts`).
- Ensure bulk follow updates trigger correct logging and add entries via `addFollowedPeopleBulk` without duplicating existing follows.

## commands/import_export.test.ts
- Verify export command prerequisites (user existence, follow data presence) and generated code properties (uppercase hex, 4-hour expiry, user persistence).
- Ensure export messaging sequence is emitted in three messages and logging occurs.
- Test import command prompt flow: empty code re-prompts, invalid/expired code handling with transfer cleanup, self-import guard, and summary generation using third-party perspective text.
- Cover confirmation follow-up for yes/no/unrecognized answers, including creation of destination user, expiry re-check, data merging without duplicates (`copyFollowData`), code invalidation, and Umami logging of `/data-import-confirmed`.

## commands/deleteProfile_stats.test.ts
- Ensure delete command responds appropriately when no user is loaded, otherwise prompts with confirmation keyboard and logs `/delete-profile`.
- Test confirmation follow-up: empty answers, slash-prefixed commands (should abort follow-up), incorrect phrases resulting in cancellation, and exact `SUPPRIMER MON COMPTE` leading to user deletion, session reset, and `/user-deletion-self` log.
- Validate stats command aggregates counts from Users/People/Organisation collections, sorts per-app counts descending, omits zero-value lines, and appends privacy statement, respecting `separateMenuMessage` option.

## commands/ena_reference_follow.test.ts
- Cover reference-follow command (`suivreFromJOReference`) for parsing references, JORF fetch success vs. failure, user confirmation prompts, and fallback messaging when reference invalid.
- Validate `promosCommand` outputs promo list formatting and keyboard differences per messaging app.
- Ensure `enaCommand` logging and follow-up prompts for manual entry behave as expected when user already follows promo vs. new follow.

## commands/commands_registry.test.ts
- Verify the `commands` array exposes regexes covering documented variants (start, search, follow, follow manual, etc.) and that manual wrappers pass reconstructed command strings correctly.
- Test precedence ordering to ensure more specific regexes fire before generic ones (e.g., `SuivreF` vs. `Suivre`).

## entities/followUpManager.test.ts
- Validate session key generation uses message app and chat id.
- Confirm `askFollowUpQuestion` stores handler/context, sends the provided question unless empty, and rolls back state on send errors.
- Ensure `handleFollowUpMessage` returns false when no handler registered, invokes handler once, clears stored state before invocation to allow re-entrancy, and respects handler return value.
- Test `clearFollowUp` and `hasFollowUp` for lifecycle management.

## entities/keyboard.test.ts
- Ensure every keyboard action lazily imports and invokes the correct command, propagating session/message arguments.
- Validate keys without actions do not throw when invoked.
- Confirm follow-up-specific keys (`FOLLOW_UP_*`) are defined without actions.

## entities/session_delivery.test.ts
- Test `loadUser` caching behavior and fallback to legacy migration (if re-enabled) while respecting schema version guards.
- Verify `recordSuccessfulDelivery` updates status and timestamp on the user document.
- Ensure `sendMessage` delegates to platform-specific senders and throws when required external options are missing.
- Add a parameterized suite iterating over every supported `MessageApp`, asserting that `sendMessage` picks the correct transport helper, forwards the `keyboard`/`forceNoKeyboard` flags unchanged, and enforces app-specific requirements (e.g., Signal CLI, WhatsApp API) for each entry in the loop.
- Validate `sendMainMenu` generates appropriate keyboard layouts per message app and error out when neither session nor external options provided.
- Test `migrateUser` updates schema version for legacy users and throws on unknown schema version.

## entities/TelegramSession.test.ts
- Validate constructor initializes defaults (main menu keyboard) and that `loadUser`/`createUser` delegate correctly.
- Test `sendMessage` chunking around Telegram limits, keyboard injection only on final chunk, typing/logging cadence, and rate limiting delays (mock timers).
- Confirm `extractTelegramSession` type guards respond appropriately and send user-facing error when requested.
- Exercise `sendTelegramMessage` happy path, keyboard handling, rate limiting retries, and error-specific handling (blocked users, deactivated users, too-many-requests backoff, unexpected errors).
- Introduce a shared loop over mocked Telegram session instances verifying app-generic guarantees (typing indicator, logging, success boolean propagation) match the contract defined for the `Session`-level tests.

## entities/SignalSession.test.ts & entities/WhatsAppSession.test.ts
- Ensure sessions construct with correct defaults, send typing/logging actions, and respect keyboard/no-keyboard options.
- Test API client wrappers for success, throttling limits (`SIGNAL_API_SENDING_CONCURRENCY`, `WHATSAPP_API_SENDING_CONCURRENCY`), error conditions (invalid tokens, missing environment variables), and delivery logging.
- Validate message formatting conversions (e.g., markdown to HTML/WhatsApp markdown) and keyboard fallbacks.
- Create a matrix-driven test that iterates through `SignalSession` and `WhatsAppSession` implementations, stubbing out their respective client APIs to confirm each class abides by the shared session contract (propagating `Keyboard`, honoring `forceNoKeyboard`, logging structure), while still asserting app-specific hooks (retry policies, markdown conversion) inside the same loop body.

## apps/*.test.ts
- For `telegramApp`, assert startup aborts when `BOT_TOKEN` missing, MongoDB connection occurs before bot launch, bot ignores bot users, logs `/message-telegram`, and wraps `processMessage` with loaded session state.
- For `signalApp` and `whatsAppApp`, cover environment guardrails, connection bootstrap, message routing to `processMessage`, and error logging without crashing the process.

## db/mongodbConnect.test.ts
- Ensure `mongodbConnect` throws the proper error when `MONGODB_URI` is absent and connects with provided URI (mocking mongoose).

## scripts/convertUsersV2toV3.test.ts
- Mock MongoDB collection interactions to ensure the migration script skips already-updated users, invokes `migrateUser` for legacy schema versions, and exits cleanly.
- Validate the script handles mixed data sets (numeric vs. string `chatId`) without duplicating work and reports/logs failures gracefully.

## models/user.test.ts
- Validate schema defaults, indexes, and `findOrCreate` behavior for new vs. existing users with logging side effects.
- Assert creation enforces required fields (`chatId`, `messageApp`, `schemaVersion`), uppercases/normalizes values where expected, and automatically assigns `USER_SCHEMA_VERSION` on insertion.
- Cover validation failures for malformed payloads (e.g., unsupported `status`, non-numeric `chatId`, missing language code) to ensure schema guards reject invalid user documents.
- Test interaction metric updates for daily/weekly/monthly logs, status transitions from blocked to active, and persistence toggles.
- Cover follow management helpers (add/check/remove for people/functions/names/organisations) for duplicates, case-insensitive comparisons, and return booleans.
- Ensure `followsNothing` reflects aggregated follow state.
- Test transfer data creation/expiry logic indirectly through helper methods (e.g., `copyFollowData`).
- Exercise migration paths: simulate legacy records with schema versions `< 3`, verify `migrateUser` promotes them to the current version, coerces numeric chat ids to strings where required, and preserves follow state; assert unknown schema versions raise errors.
- Validate update flows for persisted users (e.g., toggling `status`, updating `lastMessageReceivedAt`) honor optimistic concurrency, persist timestamps, and do not regress `schemaVersion`.

## models/people_organisation.test.ts
- Ensure `People.findOrCreate` and `Organisation.findOrCreate` handle case-insensitive matches, new record creation, and error paths.
- Cover creation validation: assert both schemas reject missing required fields (`nom`, `prenom`, `wikidataId`), enforce uniqueness of `wikidataId`, and uppercase/trim identifiers on insert.
- Verify update flows preserve normalization (e.g., updating names without breaking collation/indexing), propagate timestamp changes, and continue to satisfy unique constraints.
- Validate schema definitions include expected fields and indexes, including compound `(prenom, nom)` collation and unique `wikidataId`.

## utils/messageAppOptions.test.ts
- Test `parseEnabledMessageApps` for missing env var, unsupported apps warning (mock console), and filtering behavior.
- Validate `resolveExternalMessageOptions` merges provided options, instantiates clients only when necessary, enforces environment variables, and does not duplicate connections on repeat calls.
- Ensure Signal CLI connection and WhatsApp API wrappers are awaited/connected before returning.

## utils/JORFSearch.utils.test.ts
- Mock axios to verify each call function hits the correct URLs, handles redirects (formatted response URLs), logs Umami events, and cleans null/string responses.
- Test helper formatters (`getJORFSearchLinkPeople`, etc.) for encoding rules, uppercase transformations, and optional parameters.
- Validate `cleanPeopleName`, `cleanPeopleNameJORFURL`, and related helpers handle diacritics, casing, apostrophes/hyphens, and empty inputs.
- Cover `extractJORFTextId`, `getJORFTextLink`, and other parsing utilities present in the file.

## utils/formatSearchResult.test.ts
- Verify message assembly for various order types, handling of optional flags (confirmation/listing, organisation/cabinet omission, follower counts), Markdown vs. WhatsApp formatting, and date/reference rendering.
- Test edge cases with missing data (no grade, multiple organisations, decorations, ambassador posts).

## utils/text.utils.test.ts
- Exercise `splitText` chunking logic across newline/whitespace boundaries, zero/negative max lengths, and trimming behavior.
- Validate `parseIntAnswers` parsing with mixed delimiters, duplicates, out-of-range values, and undefined input.
- Test `escapeRegExp`, `removeSpecialCharacters`, `convertToCSV` (empty array guard), `trimStrings` for nested structures, `markdown2plainText`, `markdown2WHMarkdown`, and `markdown2html` conversions.

## utils/date.utils.test.ts
- Confirm French date formatting utilities (`dateToFrenchString`, `getISOWeek`, etc.) output expected strings and handle edge cases like DST transitions and week/year boundaries.
- Validate `JORFtoDate` conversion accuracy for various source formats.

## utils/notificationDispatch.test.ts
- Ensure tasks are sorted by record count, grouped per message app, and dispatched respecting per-app concurrency using a mocked limiter.
- Verify the dispatcher handles empty task lists gracefully.

## notifications/peopleNotifications.test.ts
- Mock database queries to ensure filtering by prenom/nom, case-insensitive matches, and deduplication logic populate `updatedPeopleList` correctly.
- Validate user filtering respects status/app restrictions and updates only relevant `followedPeople` entries with `lastUpdate` timestamps upon successful send.
- Test message assembly for single vs. multiple records, Markdown vs. WhatsApp formatting, grouping separators, and link inclusion.
- Ensure `sendPeopleUpdate` returns true when nothing to send and respects message app capabilities.

## notifications/nameNotifications.test.ts
- Cover detection of manual name follows via `cleanPeopleName`, mapping of updates to multiple spellings, and deduplication when multiple publications mention the same person.
- Ensure notifications send aggregated messages per user and update `followedNames` timestamps appropriately.

## notifications/organisationNotifications.test.ts
- Validate organisation matching against JORF records via Wikidata IDs, user filtering, and message formatting (including JORF links per platform).
- Confirm updates to `followedOrganisations.$[elem].lastUpdate` occur only after successful sends.

## notifications/functionTagNotifications.test.ts
- Ensure Function Tag notifications aggregate by tag, respect user follow preferences, and skip users without new records since `lastUpdate`.
- Test message content for Markdown vs. WhatsApp, including record grouping and reference links.

## notifications/grouping.test.ts
- Validate helper utilities (if present) for grouping notifications by time span or entity, ensuring stable ordering and correct separators.

## notifications/notifyUsers.test.ts
- Test orchestration flow: enabled apps parsing, external option resolution, Mongo connection, date window calculation, chunked day fetching with error handling, and sequential invocation of individual notification modules.
- Ensure the script exits with the correct status codes on success vs. error and logs `/notification-process-completed` once.

## scripts/connectSignal.test.ts
- Mock environment variables to confirm the script throws descriptive errors when required env vars are missing.
- Validate help flag output and that the device linking flow invokes the Signal SDK with correct parameters, handling success vs. failure paths.

## db/entities/errorMessages.test.ts
- Ensure `ErrorMessages` enum contains expected values used across the codebase and that references (e.g., Telegram app) use the correct messages.

---

Implementing the above tests will provide thorough coverage of user interaction flows (commands, keyboards, follow-ups), background notification processes, data models, and supporting utilities.
