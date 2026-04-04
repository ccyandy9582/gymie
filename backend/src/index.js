const app = require("./app");
const { env } = require("./config/env");
const { pool } = require("./db/pool");

async function start() {
  try {
    await pool.query("SELECT 1");
    app.listen(env.PORT, () => {
      console.log(`[gymie-backend] listening on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("[gymie-backend] failed to start:", error);
    process.exit(1);
  }
}

start();
