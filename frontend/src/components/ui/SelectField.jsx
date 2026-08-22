import './ui.css'
import { FormField } from './FormField.jsx'

/**
 * Dropdown select. options: [{ value, label }] or plain strings.
 */
export default function SelectField({ id, label, required, error, hint, options = [], value, onChange, disabled, name }) {
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      {(aria) => (
        <select
          {...aria}
          className="field__control"
          id={id}
          name={name ?? id}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
        >
          {options.map((option) =>
            typeof option === 'string' ? (
              <option key={option} value={option}>
                {option}
              </option>
            ) : (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ),
          )}
        </select>
      )}
    </FormField>
  )
}
