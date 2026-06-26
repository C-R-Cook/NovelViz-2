"use client";

import { authInputClass } from "@/components/auth/auth-form-utils";
import { isValidUsernameFormat, normalizeUsername, sanitizeUsernameInput } from "@/lib/username";
import { useCallback, useEffect, useMemo, useState } from "react";

export type UsernameCheckState = "idle" | "checking" | "available" | "taken" | "invalid";

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  excludeUserId?: string;
  className?: string;
  inputClassName?: string;
  hintClassName?: string;
  variant?: "default" | "integrated";
  onAvailabilityChange?: (state: {
    ready: boolean;
    normalized: string;
    checkState: UsernameCheckState;
  }) => void;
};

export function UsernameField({
  id = "register-username",
  value,
  onChange,
  disabled = false,
  excludeUserId,
  className,
  inputClassName,
  hintClassName = "mt-1 text-xs text-text-muted",
  variant = "default",
  onAvailabilityChange,
}: Props) {
  const [checkState, setCheckState] = useState<UsernameCheckState>("idle");
  const normalized = useMemo(() => normalizeUsername(value), [value]);
  const formatOk = normalized.length > 0 && isValidUsernameFormat(normalized);

  useEffect(() => {
    onAvailabilityChange?.({
      ready: formatOk && checkState === "available",
      normalized,
      checkState,
    });
  }, [checkState, formatOk, normalized, onAvailabilityChange]);

  const runCheck = useCallback(
    async (candidate: string) => {
      if (!isValidUsernameFormat(candidate)) {
        setCheckState("invalid");
        return;
      }
      setCheckState("checking");
      try {
        const params = new URLSearchParams({ username: candidate });
        if (excludeUserId) params.set("excludeUserId", excludeUserId);
        const res = await fetch(`/api/onboarding/check-username?${params.toString()}`);
        const data = (await res.json()) as { available?: boolean; valid?: boolean };
        if (!data.valid) {
          setCheckState("invalid");
          return;
        }
        setCheckState(data.available ? "available" : "taken");
      } catch {
        setCheckState("idle");
      }
    },
    [excludeUserId],
  );

  useEffect(() => {
    if (!normalized) {
      setCheckState("idle");
      return;
    }
    if (!isValidUsernameFormat(normalized)) {
      setCheckState("invalid");
      return;
    }
    const timer = window.setTimeout(() => {
      void runCheck(normalized);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [normalized, runCheck]);

  const integrated = variant === "integrated";
  const labelClass = integrated
    ? "register-consent__label-text block text-text-secondary"
    : "text-text-secondary";
  const fieldInputClass = inputClassName ?? authInputClass;

  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm">
        <span className={labelClass}>
          Choose a username <span className="text-accent-text">*</span>
        </span>
        <p className={hintClassName}>
          How you&apos;ll appear in the gallery. 3–20 characters — letters, numbers, underscores.
        </p>
        <div className="relative mt-1">
          <input
            id={id}
            name="username"
            autoComplete="username"
            value={value}
            onChange={(e) => onChange(sanitizeUsernameInput(e.target.value))}
            disabled={disabled}
            className={`${fieldInputClass} pr-10`}
            placeholder="novel_reader"
            maxLength={20}
            required
            aria-invalid={checkState === "invalid" || checkState === "taken"}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center text-lg leading-none">
            {checkState === "checking" ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-accent" />
            ) : checkState === "available" ? (
              <span className="text-success" aria-label="Available">
                ✓
              </span>
            ) : checkState === "taken" ? (
              <span className="text-error" aria-label="Taken">
                ✕
              </span>
            ) : checkState === "invalid" ? (
              <span className="text-error/80" aria-label="Invalid">
                ✕
              </span>
            ) : (
              <span className="text-text-muted" aria-hidden>
                ·
              </span>
            )}
          </span>
        </div>
      </label>
      {checkState === "taken" ? (
        <p className="mt-1.5 text-xs text-error/90">That username is already taken.</p>
      ) : null}
      {checkState === "invalid" && normalized.length > 0 ? (
        <p className="mt-1.5 text-xs text-error/90">
          Use 3–20 characters: letters, numbers, underscores only.
        </p>
      ) : null}
    </div>
  );
}

export function useUsernameAvailability(value: string, excludeUserId?: string) {
  const normalized = useMemo(() => normalizeUsername(value), [value]);
  const formatOk = normalized.length > 0 && isValidUsernameFormat(normalized);
  const [checkState, setCheckState] = useState<UsernameCheckState>("idle");

  const runCheck = useCallback(
    async (candidate: string) => {
      if (!isValidUsernameFormat(candidate)) {
        setCheckState("invalid");
        return;
      }
      setCheckState("checking");
      try {
        const params = new URLSearchParams({ username: candidate });
        if (excludeUserId) params.set("excludeUserId", excludeUserId);
        const res = await fetch(`/api/onboarding/check-username?${params.toString()}`);
        const data = (await res.json()) as { available?: boolean; valid?: boolean };
        if (!data.valid) {
          setCheckState("invalid");
          return;
        }
        setCheckState(data.available ? "available" : "taken");
      } catch {
        setCheckState("idle");
      }
    },
    [excludeUserId],
  );

  useEffect(() => {
    if (!normalized) {
      setCheckState("idle");
      return;
    }
    if (!isValidUsernameFormat(normalized)) {
      setCheckState("invalid");
      return;
    }
    const timer = window.setTimeout(() => {
      void runCheck(normalized);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [normalized, runCheck]);

  return {
    normalized,
    formatOk,
    checkState,
    ready: formatOk && checkState === "available",
  };
}
