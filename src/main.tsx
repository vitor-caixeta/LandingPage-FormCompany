import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import AdminPlaceholder from "./AdminPlaceholder";
import "./index.css";

// Remove dados persistidos por versões anteriores. O app mantém dados somente
// no Supabase e a sessão atual apenas na memória.
window.localStorage.clear();

function PageLoader() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => setIsVisible(false),
      reducedMotion ? 150 : 1850,
    );

    return () => window.clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="page-loader" aria-label="Carregando Form Company" role="status">
      <img className="page-loader-logo" src="/LogoForm.png" alt="Form Company" />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      {window.location.pathname === "/" && <PageLoader />}
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/adim" element={<AdminPlaceholder />} />
        <Route path="/admin" element={<AdminPlaceholder />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
