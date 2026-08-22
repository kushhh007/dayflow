import './ui.css'
import { FormField } from './FormField.jsx'

/**
 * Multi-line text input. rows defaults to 3.
 */
export default function TextAreaField({ id, label, required, error, hint, value, onChange, rows = 3, placeholder, disabled, name }) {
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      {(aria) => (
        <textarea
          {...aria}
          className="field__control"
          id={id}
          name={name ?? id}
          value={value}
          onChange={onChange}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
        />
      )}
    </FormField>
  )
}
