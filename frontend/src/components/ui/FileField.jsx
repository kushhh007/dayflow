import { useState } from 'react'
import './ui.css'
import { FormField } from './FormField.jsx'

/**
 * File input. Shows the chosen filename; use `accept` to restrict
 * types (e.g. '.pdf,.png' for sick-leave attachments).
 */
export default function FileField({ id, label, required, error, hint, onChange, accept, disabled, name }) {
  const [fileName, setFileName] = useState('')
  return (
    <FormField id={id} label={label} required={required} error={error} hint={hint}>
      {(aria) => (
        <>
          <input
            {...aria}
            className="field__control"
            type="file"
            id={id}
            name={name ?? id}
            accept={accept}
            disabled={disabled}
            required={required}
            onChange={(event) => {
              setFileName(event.target.files[0]?.name ?? '')
              if (onChange) onChange(event)
            }}
          />
          {fileName && <span className="field__file-name">{fileName}</span>}
        </>
      )}
    </FormField>
  )
}
