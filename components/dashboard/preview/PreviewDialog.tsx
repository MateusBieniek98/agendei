import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./ManagementPreview.module.css";

export default function PreviewDialog({ title, description, children, onClose }: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.dialogHeading}>
        <div><span className={styles.eyebrow}>DADOS DE DEMONSTRAÇÃO</span><h2 id={`${id}-title`}>{title}</h2><p id={`${id}-description`}>{description}</p></div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar detalhes">×</button>
      </div>
      {children}
    </dialog>
  );
}
