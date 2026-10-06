import { render, html } from "./lib/preact.js";
import { App } from "./App.js";

const root = document.getElementById("app");
render(html`<${App} />`, root);
