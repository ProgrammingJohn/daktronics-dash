import type { ChangeEvent } from "react";

interface FieldBaseProps {
  id: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  error?: string | null;
  helperText?: string;
}

export function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  error,
  helperText,
}: FieldBaseProps): JSX.Element {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <input
        id={id}
        className={`field-input ${error ? "field-input-error" : ""}`}
        type="text"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="field-error">{error}</span> : null}
      {!error && helperText ? <span className="field-helper">{helperText}</span> : null}
    </label>
  );
}

interface NumberFieldProps extends Omit<FieldBaseProps, "value"> {
  value: number | string;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  error,
  helperText,
  min,
  max,
  step,
}: NumberFieldProps): JSX.Element {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <input
        id={id}
        className={`field-input ${error ? "field-input-error" : ""}`}
        type="number"
        value={value}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? <span className="field-error">{error}</span> : null}
      {!error && helperText ? <span className="field-helper">{helperText}</span> : null}
    </label>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
  helperText?: string;
}

export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  error,
  helperText,
}: SelectFieldProps): JSX.Element {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <select
        id={id}
        className={`field-input ${error ? "field-input-error" : ""}`}
        value={value}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="field-error">{error}</span> : null}
      {!error && helperText ? <span className="field-helper">{helperText}</span> : null}
    </label>
  );
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ColorField({ id, label, value, onChange, disabled }: ColorFieldProps): JSX.Element {
  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <div className="color-input-wrap">
        <input
          id={id}
          className="color-swatch"
          type="color"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          className="field-input"
          type="text"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    </label>
  );
}

interface ToggleButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function ToggleButton({ label, active, onClick, disabled }: ToggleButtonProps): JSX.Element {
  return (
    <button
      type="button"
      className={`button button-toggle ${active ? "button-toggle-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioCardGroupProps {
  label: string;
  value: string;
  options: RadioCardOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function RadioCardGroup({ label, value, options, onChange, disabled }: RadioCardGroupProps): JSX.Element {
  return (
    <fieldset className="field">
      <legend className="field-label">{label}</legend>
      <div className="radio-cards">
        {options.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`radio-card ${isSelected ? "radio-card-selected" : ""}`}
              onClick={() => onChange(option.value)}
              disabled={disabled}
            >
              <span className="radio-card-title">{option.label}</span>
              {option.description ? <span className="radio-card-description">{option.description}</span> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
