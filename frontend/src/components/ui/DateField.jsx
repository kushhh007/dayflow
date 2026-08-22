import './ui.css'
import { FormField } from './FormField.jsx'

/**
 * Date picker input (type="date"). Value format: YYYY-MM-DD.
 */
export default function DateField({ id, label, required, error, hint, value, onChange, min, max, disabled, name }) {
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      {(aria) => (
        <input
          {...aria}
          className="field__control"
          type="date"
          id={id}
          name={name ?? id}
          value={value}
          onChange={onChange}
          min={min}
          max={max}
          disabled={disabled}
          required={required}
        />
      )}
    </FormField>
  )
}
