import { useEffect } from "react";

// Esta app está construida en HTML/CSS/JS puro (sin frameworks),
// según pidió el usuario. Los archivos viven en /public/app.html, app.css y app.js.
// Aquí solo redirigimos para que abrir la raíz cargue la app pura.
const Index = () => {
  useEffect(() => {
    window.location.replace("/app.html");
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      Cargando app de acordes...{" "}
      <a href="/app.html">Abrir manualmente</a>
    </div>
  );
};

export default Index;
