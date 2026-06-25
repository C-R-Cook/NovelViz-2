"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import type { Appearance } from "@clerk/types";
import type { ComponentProps } from "react";

type SignInProps = ComponentProps<typeof SignIn>;
type SignUpProps = ComponentProps<typeof SignUp>;

const embeddedSignUpAppearance: Appearance = {
  baseTheme: "dark",
  elements: {
    rootBox: "w-full",
    cardBox: "w-full max-w-none shadow-none",
    card: "w-full max-w-none bg-transparent shadow-none border-0 p-0 gap-4",
    header: "hidden",
    headerTitle: "hidden",
    headerSubtitle: "hidden",
    socialButtonsBlockButton:
      "border border-border-default bg-bg-elevated/60 text-text-primary hover:bg-bg-hover",
    dividerLine: "bg-border-subtle",
    dividerText: "text-text-muted text-xs",
    formFieldLabel: "text-text-secondary text-sm",
    formFieldInput:
      "border-border-default bg-bg-elevated/80 text-text-primary focus:border-accent/50",
    formButtonPrimary:
      "bg-accent text-text-on-accent hover:opacity-90 normal-case text-sm font-medium shadow-none",
    footer: "bg-transparent pt-2",
    footerActionText: "text-text-muted text-sm",
    footerActionLink: "text-accent-text hover:text-text-primary",
    identityPreview: "border-border-default bg-bg-elevated/60",
    formFieldInputShowPasswordButton: "text-text-muted hover:text-text-primary",
  },
};

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

type ClerkThemedSignUpProps = SignUpProps & {
  /** Strip Clerk card chrome — use inside NovelViz register shell. */
  embedded?: boolean;
};

export function ClerkThemedSignUp({ embedded = false, appearance, ...rest }: ClerkThemedSignUpProps) {
  if (embedded) {
    return (
      <SignUp
        {...rest}
        appearance={{
          ...embeddedSignUpAppearance,
          ...appearance,
          elements: {
            ...embeddedSignUpAppearance.elements,
            ...appearance?.elements,
          },
        }}
      />
    );
  }

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
