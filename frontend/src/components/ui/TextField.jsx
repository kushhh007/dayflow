import './ui.css'
import { FormField } from './FormField.jsx'

/**
 * Single-line text input. Pass `type` ('text' | 'email' | 'password' | ...).
 */
export default function TextField({ id, label, required, error, hint, type = 'text', value, onChange, placeholder, disabled, autoComplete, name }) {
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      {(aria) => (
        <input
          {...aria}
          className="field__control"
          type={type}
          id={id}
          name={name ?? id}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete={autoComplete}
          required={required}
        />
      )}
    </FormField>
  )
}
