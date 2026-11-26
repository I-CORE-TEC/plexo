import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Spinner } from "../components/ui";

function AtlasDocument() {
  const [result, setResult] = useState(null);

  useEffect(() => {
    let current = true;
    api.get("/atlas/").then(({ html }) => {
      if (!current) return;
      setResult({ html });
    }).catch((error) => {
      if (current) setResult({ denied: error.status === 401 || error.status === 403 });
    });
    return () => {
      current = false;
    };
  }, []);

  if (!result) return <Spinner label="Cargando atlas…" />;
  if (result.denied) return <Denied />;
  if (!result.html) return <p role="alert" className="p-6">No se pudo cargar el atlas.</p>;

  return (
    <iframe
      title="Atlas de PLEXO"
      className="block h-dvh w-full border-0"
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={result.html}
    />
  );
}

function Denied() {
  return <h1 className="p-6 text-lg font-semibold">Acceso denegado</h1>;
}

export default function Atlas() {
  const { user } = useAuth();
  if (!user?.is_superuser || user.simulacion) return <Denied />;
  return <AtlasDocument key={user.id} />;
}