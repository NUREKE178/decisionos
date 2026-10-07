import { render, html, Fragment } from "./lib/preact.js";
import { App } from "./App.js";
import { ToastHost } from "./components/ui.js";

const root = document.getElementById("app");
render(html`<${Fragment}><${App} /><${ToastHost} /><//>`, root);
