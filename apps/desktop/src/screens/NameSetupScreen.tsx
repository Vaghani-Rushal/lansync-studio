import { useState } from "react";

type Props = {
  initialName?: string;
  title?: string;
  submitLabel?: string;
  onSubmit: (displayName: string) => Promise<{ ok: boolean; error?: string }>;
  onCancel?: () => void;
};

const validate = (value: string): string | null => {
  const trimmed = value.trim();
  if (trimmed.length < 2) return "Name must be at least 2 characters";
  if (trimmed.length > 32) return "Name must be at most 32 characters";
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return "Name contains invalid characters";
  return null;
};

export const NameSetupScreen = ({
  initialName = "",
  title = "What should we call you?",
  submitLabel = "Continue",
  onSubmit,
  onCancel
}: Props) => {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(name.trim());
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? "Failed to save name");
    }
  };

  return (
    <section className="screen ui-shell">
      <div className="brand-block">
        <div className="brand-icon">L</div>
        <div>
          <h1>{title}</h1>
          <p className="muted">Your name is shown to the host and other users in the session. Stored locally on this device only.</p>
        </div>
      </div>

      <div className="card-surface" style={{ display: "grid", gap: "var(--space-4)" }}>
        <p className="eyebrow">Display name</p>
        <div className="input-with-icon">
          <span className="input-icon">◎</span>
          <input
            value={name}
            autoFocus
            placeholder="e.g. Alex"
            maxLength={32}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSubmit();
            }}
          />
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          2–32 characters · peers see this name
        </div>
        {error ? <div className="error-banner">{error}</div> : null}
      </div>

      <div className="row-wrap" style={{ justifyContent: "flex-end" }}>
        {onCancel ? (
          <button className="ghost-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        ) : null}
        <button className="primary-btn" disabled={submitting || name.trim().length < 2} onClick={handleSubmit}>
          {submitting ? "Saving…" : submitLabel}
        </button>
      </div>
    </section>
  );
};
