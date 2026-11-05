import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type Severity = "info" | "success" | "warning" | "error";

const SYMBOL: Record<Severity, string> = { info: "i", success: "✓", warning: "!", error: "!" };

interface Props {
  severity: Severity;
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  /** Texto pequeno embaixo: hora da última leitura, código técnico. */
  footnote?: ReactNode;
  icon?: string;
  onClose?: () => void;
}

/** Aviso em linha no estilo InfoBar do Windows: gravidade, título, texto e ações. */
export default function Notice({ severity, title, children, actions, footnote, icon, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <div className={`notice is-${severity}`} role={severity === "error" ? "alert" : "status"}>
      <span className="notice-icon" aria-hidden="true">
        {icon ?? SYMBOL[severity]}
      </span>
      <div className="notice-body">
        {title && <strong>{title}</strong>}
        {children && <span>{children}</span>}
        {actions && <div className="notice-actions">{actions}</div>}
        {footnote && <span className="notice-foot">{footnote}</span>}
      </div>
      {onClose && (
        <button className="notice-close" aria-label={t("close")} onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  );
}
