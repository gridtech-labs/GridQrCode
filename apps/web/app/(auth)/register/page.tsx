"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../../store/authStore";

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  restaurantName: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  restaurantName?: string;
}

function validateForm(form: FormData): FormErrors {
  const errors: FormErrors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required";
  if (!form.lastName.trim()) errors.lastName = "Last name is required";
  if (!form.email.includes("@")) errors.email = "Enter a valid email";
  if (form.password.length < 8) errors.password = "At least 8 characters";
  else if (!/[A-Z]/.test(form.password)) errors.password = "Include an uppercase letter";
  else if (!/[0-9]/.test(form.password)) errors.password = "Include a number";
  if (form.password !== form.confirmPassword) errors.confirmPassword = "Passwords do not match";
  if (form.restaurantName.trim().length < 2) errors.restaurantName = "Restaurant name is required";
  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerUser, isLoading, error, clearError } = useAuthStore();

  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    restaurantName: "",
  });

  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear individual field error on change
    if (fieldErrors[name as keyof FormErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    try {
      await registerUser({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        restaurantName: form.restaurantName,
      });
      router.push("/dashboard");
    } catch {
      // Error displayed from store
    }
  };

  const Field = ({
    id,
    label,
    type = "text",
    placeholder,
    autoComplete,
  }: {
    id: keyof FormData;
    label: string;
    type?: string;
    placeholder: string;
    autoComplete?: string;
  }) => (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type === "password" && showPassword ? "text" : type}
        autoComplete={autoComplete}
        value={form[id]}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 rounded-lg border text-sm transition
                    bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                    placeholder:text-slate-400
                    focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                    ${fieldErrors[id]
                      ? "border-red-400 dark:border-red-600"
                      : "border-slate-200 dark:border-slate-700"
                    }`}
      />
      {fieldErrors[id] && (
        <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors[id]}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Create your account</h2>
        <p className="text-slate-500 mt-1 text-sm">Start your 14-day free trial — no credit card required</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field id="firstName" label="First name" placeholder="Jane" autoComplete="given-name" />
          <Field id="lastName" label="Last name" placeholder="Doe" autoComplete="family-name" />
        </div>

        <Field id="restaurantName" label="Restaurant name" placeholder="Luigi's Bistro" />

        <Field
          id="email"
          label="Work email"
          type="email"
          placeholder="jane@luigis.com"
          autoComplete="email"
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            className={`w-full px-4 py-2.5 rounded-lg border text-sm transition
                        bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                        placeholder:text-slate-400
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                        ${fieldErrors.password ? "border-red-400" : "border-slate-200 dark:border-slate-700"}`}
          />
          {fieldErrors.password && (
            <p className="text-xs text-red-600">{fieldErrors.password}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Repeat your password"
            className={`w-full px-4 py-2.5 rounded-lg border text-sm transition
                        bg-white dark:bg-slate-800 text-slate-900 dark:text-white
                        placeholder:text-slate-400
                        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
                        ${fieldErrors.confirmPassword ? "border-red-400" : "border-slate-200 dark:border-slate-700"}`}
          />
          {fieldErrors.confirmPassword && (
            <p className="text-xs text-red-600">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        <p className="text-xs text-slate-400">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline">Terms of Service</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60
                     text-white font-semibold text-sm transition
                     focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {isLoading ? "Creating account…" : "Start free trial →"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
