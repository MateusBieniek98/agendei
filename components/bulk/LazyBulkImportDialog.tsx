"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type {
  BulkImportColumn,
  BulkImportDialogProps,
} from "./BulkImportDialog";
import { FormSkeleton, Skeleton } from "@/components/ui/Skeleton";

const BulkImportDialog = dynamic(() => import("./BulkImportDialog"), {
  loading: () => (
    <div className="ui-overlay fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" data-state="open" role="status" aria-label="Abrindo importação">
      <section className="ui-dialog-panel max-h-[94dvh] w-full max-w-6xl overflow-hidden rounded-t-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-xl sm:rounded-lg sm:p-5">
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="mt-2 h-3 w-96 max-w-full" />
        <div className="mt-5">
          <FormSkeleton fields={4} />
        </div>
      </section>
    </div>
  ),
});

export type { BulkImportColumn };

export default function LazyBulkImportDialog(props: BulkImportDialogProps) {
  const [requested, setRequested] = useState(props.open);

  useEffect(() => {
    if (props.open) setRequested(true);
  }, [props.open]);

  if (!requested && !props.open) return null;
  return <BulkImportDialog {...props} />;
}
