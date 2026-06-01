import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getOptionalSession } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getOptionalSession();
  if (user) redirect("/dashboard");
  return <LoginForm />;
}
