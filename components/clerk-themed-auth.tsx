"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import type { ComponentProps } from "react";
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  const root = document.documentElement;
  const obs = new MutationObserver(onChange);
  obs.observe(root, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("storage", onChange);
  return () => {
    obs.disconnect();
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Matches theme script default before hydration. */
function getServerSnapshot(): boolean {
  return true;
}

function useSiteDarkMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

type SignInProps = ComponentProps<typeof SignIn>;
type SignUpProps = ComponentProps<typeof SignUp>;

export function ClerkThemedSignIn(props: SignInProps) {
  const isDark = useSiteDarkMode();
  const { appearance, ...rest } = props;
  return (
    <SignIn
      {...rest}
      appearance={{
        ...appearance,
        baseTheme: isDark ? "dark" : "light",
      }}
    />
  );
}

export function ClerkThemedSignUp(props: SignUpProps) {
  const isDark = useSiteDarkMode();
  const { appearance, ...rest } = props;
  return (
    <SignUp
      {...rest}
      appearance={{
        ...appearance,
        baseTheme: isDark ? "dark" : "light",
      }}
    />
  );
}
