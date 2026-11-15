import { App } from "./app.js";

// Entry point. Inside the Claude artifact viewer, the hot-reload hook hands back the last
// snapshot and asks for a new one; on a plain page the app just starts with a fresh roll.
const app = new App();
const hot = window.claude?.hot;

function boot(data) {
  app.start(data);
  try { hot?.snapshot?.(() => app.snapshot()); } catch (e) { /* outside the viewer */ }
}

hot?.ready ? hot.ready(boot) : boot(hot?.data ?? {});
