const { createApp } = require("./app");
const { PORT } = require("./config");
const { connectDatabase } = require("./config/database");

async function start() {
  await connectDatabase();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
