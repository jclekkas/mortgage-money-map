import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import css from "./styles.css?inline";
import App from "./App";

const style = document.createElement("style");
style.textContent = css;
document.head.appendChild(style);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
