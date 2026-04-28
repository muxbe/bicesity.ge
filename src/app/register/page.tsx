import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

export default function RegisterPage() {
  return (
    <Suspense>
      <LoginForm initialMode="signup" />
    </Suspense>
  );
}
