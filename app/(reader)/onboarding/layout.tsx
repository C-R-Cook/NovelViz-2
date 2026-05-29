import "./onboarding.css";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="onboarding-root">{children}</div>;
}
