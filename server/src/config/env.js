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
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
