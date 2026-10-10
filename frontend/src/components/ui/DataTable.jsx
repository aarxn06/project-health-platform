import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * DataTable (Section 2.3):
 * Dark table with sticky header, thin row dividers (#1F1F25), sortable columns,
 * hover row (#16161A), monospace file paths, tabular numerals, and pagination.
 */
export function DataTable({
  columns = [],
  data = [],
  rowKey = 'id',
  sortField,
  sortOrder = 'desc',
  onSortChange,
  onRowClick,
  selectedRowKey,
  currentPage = 1,
  pageSize = 10,
  onPageChange,
  emptyMessage = 'No matching records found.',
  maxHeight = '',
  className = '',
}) {
  const totalRows = data.length;
  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
  const safePage = Math.min(currentPage, totalPages);

  const visibleRows =
    pageSize > 0
      ? data.slice((safePage - 1) * pageSize, safePage * pageSize)
      : data;

  const handleHeaderClick = (col) => {
    if (!col.sortable || !onSortChange) return;
    if (sortField === col.key) {
      onSortChange(col.key, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(col.key, col.defaultSortOrder || 'desc');
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className={`overflow-x-auto ${maxHeight ? `overflow-y-auto ${maxHeight}` : ''}`}>
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-[#0E0E11] border-b border-[#1F1F25] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#A1A1AA] select-none">
            <tr>
              {columns.map((col) => {
                const isSorted = sortField === col.key;
                const alignClass =
                  col.align === 'right'
                    ? 'text-right'
                    : col.align === 'center'
                    ? 'text-center'
                    : 'text-left';

                return (
                  <th
                    key={col.key}
                    onClick={() => handleHeaderClick(col)}
                    className={`py-2.5 px-3.5 ${alignClass} ${
                      col.sortable
                        ? 'cursor-pointer hover:text-[#F4F4F5] transition-colors'
                        : ''
                    } ${col.headerClassName || ''}`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 ${
                        col.align === 'right' ? 'justify-end' : ''
                      }`}
                    >
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className={isSorted ? 'text-[#7C5CFF]' : 'text-[#6B6B76]'}>
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="w-3 h-3" />
                            ) : (
                              <ArrowDown className="w-3 h-3" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-60" />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F1F25] text-xs">
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-10 px-4 text-center text-xs text-[#6B6B76]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, idx) => {
                const keyVal = typeof rowKey === 'function' ? rowKey(row, idx) : row[rowKey] ?? idx;
                const isSelected = selectedRowKey !== undefined && selectedRowKey === keyVal;

                return (
                  <tr
                    key={keyVal}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`transition-colors duration-150 ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${
                      isSelected
                        ? 'bg-[#7C5CFF]/10 hover:bg-[#7C5CFF]/15'
                        : 'hover:bg-[#16161A]'
                    }`}
                  >
                    {columns.map((col) => {
                      const alignClass =
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left';
                      const monoClass = col.mono ? 'font-mono tabular-nums' : '';

                      return (
                        <td
                          key={col.key}
                          className={`py-2.5 px-3.5 ${alignClass} ${monoClass} ${
                            col.cellClassName || ''
                          }`}
                        >
                          {col.render ? col.render(row, idx) : row[col.key]}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pageSize > 0 && totalPages > 1 && onPageChange && (
        <div className="px-4 py-2.5 bg-[#0E0E11] border-t border-[#1F1F25] flex items-center justify-between text-xs text-[#A1A1AA]">
          <span className="font-mono text-[11px] text-[#6B6B76] tabular-nums">
            Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, totalRows)} of{' '}
            {totalRows}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
              className="p-1 rounded border border-[#1F1F25] bg-[#111114] hover:border-[#2A2A32] hover:text-[#F4F4F5] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-[#F4F4F5] tabular-nums">
              {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
              className="p-1 rounded border border-[#1F1F25] bg-[#111114] hover:border-[#2A2A32] hover:text-[#F4F4F5] disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

