import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: React.ReactNode;
}

const ModalPortal: React.FC<PortalProps> = ({ children }) => {
  // Estado para saber si la página ya cargó en el navegador
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Buscamos el lugar de destino que creamos en el Paso 1
  const modalRoot = document.getElementById('modal-root');

  // Si aún no carga o no encuentra el destino, no mostramos nada
  if (!mounted || !modalRoot) return null;

  // ¡Aquí ocurre la magia! "Teletransportamos" los hijos (el modal) al destino
  return createPortal(children, modalRoot);
};

export default ModalPortal;