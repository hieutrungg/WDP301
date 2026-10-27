const requiredVariables = ["MONGODB_URI", "JWT_ACCESS_SECRET", "CLIENT_URL"];

export const validateEnvironment = () => {
  const missingVariables = requiredVariables.filter(
    (variableName) => !process.env[variableName]?.trim(),
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVariables.join(", ")}`,
    );
  }
};

export const env = {
  get port() {
    return Number(process.env.PORT) || 5000;
  },
  get mongodbUri() {
    return process.env.MONGODB_URI;
  },
  get jwtAccessSecret() {
    return process.env.JWT_ACCESS_SECRET;
  },
  get clientUrl() {
    return process.env.CLIENT_URL;
  },
  get googleClientId() {
    return process.env.GOOGLE_CLIENT_ID?.trim();
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get isTest() {
    return process.env.NODE_ENV === "test";
  },
  get emailHost() {
    return process.env.EMAIL_HOST;
  },
  get emailPort() {
    return Number(process.env.EMAIL_PORT) || 587;
  },
  get emailUser() {
    return process.env.EMAIL_USER;
  },
  get emailPass() {
    return process.env.EMAIL_PASS;
  },
  get emailFrom() {
    return process.env.EMAIL_FROM;
  },
  // payOS bank transfer is enabled only when all three credentials are present.
  get payos() {
    const clientId = process.env.PAYOS_CLIENT_ID?.trim();
    const apiKey = process.env.PAYOS_API_KEY?.trim();
    const checksumKey = process.env.PAYOS_CHECKSUM_KEY?.trim();
    if (!clientId || !apiKey || !checksumKey) return null;
    return {
      clientId,
      apiKey,
      checksumKey,
      baseUrl: process.env.PAYOS_API_BASE_URL?.trim() || "https://api-merchant.payos.vn",
    };
  },
};
