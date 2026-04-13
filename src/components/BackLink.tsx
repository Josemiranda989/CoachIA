import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  href?: string;
  label?: string;
  className?: string;
};

export function BackLink({ href = "/", label = "Volver", className = "" }: Props) {
  return (
    <Link href={href} className={`back-btn ${className}`.trim()}>
      <ArrowLeft size={16} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
