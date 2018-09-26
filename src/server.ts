import errorHandler from "errorhandler";

import app from "./app";

/**
 * Error Handler. Provides full stack - remove for production
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
const server = app.listen(app.get("port"), () => {
  console.log(
    "  App is running at http://localhost:%d in %s mode",
    app.get("port"),
    app.get("env")
  );
  console.log("  Press CTRL-C to stop\n");
});




import CosmosFetcher from "./fetcher";
import { CronJob } from "cron";

const fetchingServer = new CosmosFetcher();

fetchingServer.populateProposals().then(() => {
  // Only start the proposal monitoring after all proposals have been fully populated once

  // Check for new proposal every 5 seconds
  new CronJob("*/5 * * * * *", () => {
    fetchingServer.fetchNewProposals();
  }, undefined, true, "America/New_York");

});

// Check for new blocks every second
new CronJob("* * * * * *", () => {
  fetchingServer.fetchCurrentStatus().then((data) => {
  });
}, undefined, true, "America/New_York");


export default server;
