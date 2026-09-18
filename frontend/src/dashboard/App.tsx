// WS-1 · Daniela — Layout y navegación del dashboard.
// El router es de memoria a propósito: la URL la manda la shell de WS-0 (`?mock=1`, views.ts),
// así que el dashboard no se la pelea y las rutas internas siguen siendo rutas de React Router.
import { useEffect, useRef, useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { Deps } from '../contracts';
import { LAB_ROUTE, ROUTES } from './config';
import { ChatView } from './components/ChatView';
import { Composer } from './components/Composer';
import { LabHandoff } from './components/LabHandoff';
import { LogsPanel } from './components/LogsPanel';
import { Sidebar } from './components/Sidebar';
import { StatusPanel } from './components/StatusPanel';
import { TopBar } from './components/TopBar';
import { ViewerView } from './components/ViewerView';
import { LabProvider } from './state/LabProvider';
import './dashboard.css';

/** Mueve el <div id="status-bar"> (que llena WS-4) a su sitio conservando el nodo original. */
function StatusBarSlot({ node }: { node: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.appendChild(node);
  }, [node]);
  return <div className="statusslot" ref={ref} />;
}

function ChatScreen() {
  return (
    <>
      <ChatView />
      <Composer />
    </>
  );
}

function Shell({ statusBar }: { statusBar: HTMLElement }) {
  const [open, setOpen] = useState(() => window.innerWidth >= 1100);

  return (
    <div className={`app${open ? ' app--menu' : ''}`}>
      <TopBar sidebarOpen={open} onToggleSidebar={() => setOpen((v) => !v)} />
      <div className="app__body">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        {open && <div className="app__scrim" onClick={() => setOpen(false)} />}
        <main className="app__main">
          <Routes>
            <Route path={ROUTES.chat} element={<ChatScreen />} />
            <Route path={ROUTES.pieza} element={<ViewerView />} />
            <Route path={ROUTES.estado} element={<StatusPanel />} />
            <Route path={ROUTES.logs} element={<LogsPanel />} />
            {/* La vista del lab es de WS-2; esta ruta solo hace el traspaso a la shell. */}
            <Route path={LAB_ROUTE} element={<LabHandoff />} />
            <Route path="*" element={<ChatScreen />} />
          </Routes>
        </main>
      </div>
      <StatusBarSlot node={statusBar} />
    </div>
  );
}

export function App({ deps, statusBar }: { deps: Deps; statusBar: HTMLElement }) {
  return (
    <LabProvider deps={deps}>
      <MemoryRouter initialEntries={[ROUTES.chat]}>
        <Shell statusBar={statusBar} />
      </MemoryRouter>
    </LabProvider>
  );
}
