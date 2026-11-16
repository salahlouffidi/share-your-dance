import { requestExpandedMode } from "@devvit/web/client";
const button = document.getElementById("open");
button?.addEventListener("click", (event) =>
  requestExpandedMode(event, "game"),
);
