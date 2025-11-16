import mongoose from "mongoose";
import { ErrorMessages } from "./entities/ErrorMessages.ts";

mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export const mongodbConnect = async () => {
  const {
    MONGODB_URI,
    MONGODB_USERNAME,
    MONGODB_PASSWORD,
    MONGODB_DB_NAME,
    MONGODB_TLS_CA_FILE,
    MONGODB_AUTH_SOURCE,
    MONGODB_TLS_CERT_KEY_FILE
  } = process.env;

  if (!MONGODB_URI) {
    throw new Error(ErrorMessages.MONGODB_URI_NOT_SET);
  }

  if (!MONGODB_USERNAME || !MONGODB_PASSWORD) {
    throw new Error(ErrorMessages.MONGODB_CREDENTIALS_NOT_SET);
  }

  if (!MONGODB_DB_NAME) {
    throw new Error(ErrorMessages.MONGODB_DB_NAME_NOT_SET);
  }

  if (!MONGODB_TLS_CA_FILE) {
    throw new Error(ErrorMessages.MONGODB_TLS_CONFIG_INVALID);
  }

  const tlsOptions: mongoose.ConnectOptions = {
    tls: true,
    tlsCAFile: MONGODB_TLS_CA_FILE,
    tlsAllowInvalidCertificates: false
  };

  if (MONGODB_TLS_CERT_KEY_FILE) {
    tlsOptions.tlsCertificateKeyFile = MONGODB_TLS_CERT_KEY_FILE;
  }

  await mongoose.connect(MONGODB_URI, {
    user: MONGODB_USERNAME,
    pass: MONGODB_PASSWORD,
    dbName: MONGODB_DB_NAME,
    authSource: MONGODB_AUTH_SOURCE ?? MONGODB_DB_NAME,
    retryWrites: true,
    w: "majority",
    readPreference: "primary",
    ...tlsOptions
  });
};
