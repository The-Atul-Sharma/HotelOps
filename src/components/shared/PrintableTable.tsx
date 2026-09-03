type Column = {
  key: string;
  label: string;
  align?: 'right';
};

type Props = {
  title: string;
  columns: Column[];
  rows: Record<string, unknown>[];
};

const cellClass = 'print-table-cell';

export function PrintableTable({ title, columns, rows }: Props) {
  return (
    <div className="print-only">
      <h1 className="mb-4 text-lg font-bold">{title}</h1>
      <div className="print-table-wrap">
        <table className="print-table text-sm">
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`${cellClass} text-left font-semibold ${c.align === 'right' ? 'text-right' : ''}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className={`${cellClass} py-4 text-center`}>
                  No data
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={`${cellClass} ${c.align === 'right' ? 'text-right tabular-nums' : ''}`}
                    >
                      {String(row[c.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
