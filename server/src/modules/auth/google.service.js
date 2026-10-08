import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";

let client;

const verify = async (credential) => {
  if (!env.googleClientId) {
    throw new AppError(503, "Google sign-in is not configured");
  }

  client ??= new OAuth2Client();

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.googleClientId,
    });
    const payload = ticket.getPayload();

    return {
      email: payload.email?.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name,
    };
  } catch {
    throw new AppError(401, "Google sign-in failed. Please try again.");
  }
};

// Wrapped in an object so tests can replace the network call to Google.
export const googleTokenVerifier = { verify };
