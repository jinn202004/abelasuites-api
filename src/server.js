const { createApp } = require("./app");
const { PORT, AUTO_APPROVE_REVIEWS, TESTIMONIALS_REQUIRE_APPROVAL } = require("./config");
const { connectDatabase } = require("./config/database");

async function start() {
  await connectDatabase();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(
      `Guest reviews: AUTO_APPROVE_REVIEWS=${AUTO_APPROVE_REVIEWS}; TESTIMONIALS_REQUIRE_APPROVAL=${TESTIMONIALS_REQUIRE_APPROVAL} (when true, /api/testimonials only lists isApproved reviews)`
    );
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
