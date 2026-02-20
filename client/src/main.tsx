import '@/lib/agGridSetup';
import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import App from "./App";
import "./index.css";

const basePath = import.meta.env.PROD ? "/crewing" : "";

createRoot(document.getElementById("root")!).render(
  <Router base={basePath}>
    <App />
  </Router>
);
