export enum ErrorMessages {
  MONGODB_URI_NOT_SET = "MONGODB_URI is not set. Please set it in your .env file",
  MONGODB_CREDENTIALS_NOT_SET = "MongoDB credentials are not set. Please provide MONGODB_USERNAME and MONGODB_PASSWORD in your environment",
  MONGODB_DB_NAME_NOT_SET = "MongoDB database name is not set. Please provide MONGODB_DB_NAME in your environment",
  MONGODB_TLS_CONFIG_INVALID = "MongoDB TLS configuration is incomplete. Please provide MONGODB_TLS_CA_FILE (and related TLS parameters if required)",
  TELEGRAM_BOT_TOKEN_NOT_SET = "BOT_TOKEN is not set. Please set it in your .env file",
  WHATSAPP_ENV_NOT_SET = "WHATSAPP_ENV variables are not set. Please set it in your .env file",
  SIGNAL_ENV_NOT_SET = "SIGNAL_ENV variables are not set. Please set it in your .env file"
}
