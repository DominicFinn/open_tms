import React, { ReactNode } from 'react';

interface KanbanColumn<T> {
  key: string;
  label: string;
  cssClass: string;
  items: T[];
}

interface VnKanbanProps<T> {
  columns: KanbanColumn<T>[];
  renderCard: (item: T) => ReactNode;
}

export function VnKanban<T>({ columns, renderCard }: VnKanbanProps<T>) {
  return (
    <div className="vn-kanban">
      {columns.map(col => (
        <div key={col.key} className={`vn-kanban-col ${col.cssClass}`}>
          <div className="vn-kanban-col-header">
            {col.label} <span className="vn-count">{col.items.length}</span>
          </div>
          <div className="vn-kanban-cards">
            {col.items.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '13px' }}>
                No items
              </div>
            ) : (
              col.items.map((item, i) => (
                <React.Fragment key={i}>{renderCard(item)}</React.Fragment>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
