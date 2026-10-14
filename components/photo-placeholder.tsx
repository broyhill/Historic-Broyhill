type PhotoPlaceholderProps = {
  label: string;
  className?: string;
};

export function PhotoPlaceholder({ label, className = "" }: PhotoPlaceholderProps) {
  return (
    <div className={`photo-placeholder ${className}`} role="img" aria-label={label}>
      <span className="photo-mark" aria-hidden="true">HB</span>
      <span className="photo-label">{label}</span>
    </div>
  );
}
