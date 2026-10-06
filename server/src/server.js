import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";
import { env, validateEnvironment } from "./config/env.js";

const startServer = async () => {
  try {
    validateEnvironment();
    await connectDatabase();

    app.listen(env.port, () => {
      console.log(`Server running on port ${env.port}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error.message);
    process.exit(1);
  }
};

startServer();
