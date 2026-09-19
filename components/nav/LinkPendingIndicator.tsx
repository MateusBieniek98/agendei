"use client";

import { useLinkStatus } from "next/link";

export default function LinkPendingIndicator() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className="link-pending-indicator"
      data-pending={pending ? "true" : "false"}
    />
  );
}
