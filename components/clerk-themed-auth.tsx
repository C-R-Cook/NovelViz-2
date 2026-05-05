"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type SignInProps = ComponentProps<typeof SignIn>;
type SignUpProps = ComponentProps<typeof SignUp>;

export function ClerkThemedSignIn(props: SignInProps) {
  const { appearance, ...rest } = props;
  return (
    <SignIn
      {...rest}
      appearance={{
        ...appearance,
        baseTheme: "dark",
      }}
    />
  );
}

export function ClerkThemedSignUp(props: SignUpProps) {
  const { appearance, ...rest } = props;
  return (
    <SignUp
      {...rest}
      appearance={{
        ...appearance,
        baseTheme: "dark",
      }}
    />
  );
}
