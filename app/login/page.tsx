import { Suspense } from "react";
import { getLoginSettings } from "@/lib/app-settings";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const settings = await getLoginSettings();

  return (
    <Suspense fallback={<LoginClient settings={settings} />}>
      <LoginClient settings={settings} />
    </Suspense>
  );
}
