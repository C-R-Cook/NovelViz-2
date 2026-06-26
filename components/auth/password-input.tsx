"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";
import { authInputClass } from "@/components/auth/auth-form-utils";

type PasswordInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: "new-password" | "current-password";
  placeholder?: string;
  minLength?: number;
  required?: boolean;
  id?: string;
};

export function PasswordInput({
  value,
  onChange,
  disabled = false,
  autoComplete = "current-password",
  placeholder,
  minLength,
  required = false,
  id,
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className="register-flow__password-wrap">
      <input
        id={inputId}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${authInputClass.replace("mt-1 ", "")} register-flow__password-input`}
        placeholder={placeholder}
      />
      <button
        type="button"
        className="register-flow__password-toggle"
        onClick={() => setVisible((current) => !current)}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
      </button>
    </div>
  );
}
