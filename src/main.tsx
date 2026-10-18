import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import WinePage from "./WinePage";
import "./styles.css";
import "./wine.css";
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WinePage />
  </StrictMode>,
);
