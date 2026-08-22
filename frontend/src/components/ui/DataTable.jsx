import EmptyState from '../states/EmptyState.jsx'
import './ui.css'

/**
 * Read-only data table.
 * columns: [{ key, label, align?: 'right', render?: (row) => node }]
 * rows: array of objects. rowKey: (row) => unique id (defaults to row.id).
 * When rows is empty the `empty` node is rendered instead (defaults to an
 * EmptyState card).
 */
export default function DataTable({ columns, rows = [], rowKey, empty, clickableRows = false }) {
  if (rows.length === 0) {
    return empty ?? <EmptyState title="No records found" />
  }
  const keyOf = rowKey ?? ((row) => row.id)
  return (
    <div className="table-wrap">
      <table className={`table${clickableRows ? ' table--clickable' : ''}`}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.align === 'right' ? 'is-numeric' : undefined} style={column.width ? { width: column.width } : undefined}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyOf(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'right' ? 'is-numeric' : undefined}>
                  {column.render ? column.render(row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
