import { use_session } from "../state/SessionProvider";
import { OperatorConsole } from "./console/OperatorConsole";
import { SessionLauncher } from "./launch/SessionLauncher";

export function App() {
  const { state } = use_session();

  if (state.phase === "active") return <OperatorConsole />;
  if (state.phase === "launching") return <main className="app-message">Launching session…</main>;
  if (state.phase === "stopping") return <main className="app-message">Closing session…</main>;
  return <SessionLauncher />;
}
