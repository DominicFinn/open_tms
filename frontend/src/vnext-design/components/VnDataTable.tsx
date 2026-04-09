import React, { ReactNode } from 'react';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
}

interface VnDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyMessage?: string;
}

export function VnDataTable<T extends Record<string, unknown>>({
  columns, data, onRowClick, emptyIcon = 'inbox', emptyTitle = 'No data', emptyMessage,
}: VnDataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="vn-empty">
        <span className="material-icons">{emptyIcon}</span>
        <h3>{emptyTitle}</h3>
        {emptyMessage && <p>{emptyMessage}</p>}
      </div>
    );
  }

  return (
    <div className="vn-table-wrap">
      <table className="vn-table">
        <thead>
          <tr>
            {columns.map(col => <th key={col.key}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} onClick={() => onRowClick?.(row)} style={onRowClick ? { cursor: 'pointer' } : undefined}>
              {columns.map(col => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
