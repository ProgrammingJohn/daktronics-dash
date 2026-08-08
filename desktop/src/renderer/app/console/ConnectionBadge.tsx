import type { ConnectionStatus } from "../../domain/session";
import styles from "./OperatorConsole.module.css";

export function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  return (
    <span className={styles.connectionBadge} data-status={status}>
      <span className={styles.statusDot} aria-hidden="true" />
      {status.toUpperCase()}
    </span>
  );
}
