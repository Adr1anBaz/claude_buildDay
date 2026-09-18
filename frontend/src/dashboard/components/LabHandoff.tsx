// WS-1 · Daniela — Ruta /lab. Existe en React Router, pero la vista del lab la monta WS-0 fuera de React.
// Aquí solo se hace el traspaso y se devuelve el router a la conversación, para que al volver
// del laboratorio el chat, el archivo y la orden sigan intactos.
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ROUTES } from '../config';
import { useLab } from '../state/LabProvider';

export function LabHandoff() {
  const { deps } = useLab();
  const navigate = useNavigate();

  useEffect(() => {
    deps.showView('lab');
    navigate(ROUTES.chat, { replace: true });
  }, [deps, navigate]);

  return null;
}
