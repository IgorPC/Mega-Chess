import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table'
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Box, Typography, CircularProgress, Pagination,
} from '@mui/material'
import { useState } from 'react'

interface DataTableProps<T> {
  data: T[]
  columns: ColumnDef<T, unknown>[]
  loading?: boolean
  totalPages?: number
  page?: number
  onPageChange?: (page: number) => void
  emptyMessage?: string
}

export function DataTable<T>({
  data, columns, loading, totalPages, page, onPageChange, emptyMessage = 'Nenhum registro encontrado',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
  })

  return (
    <Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableCell key={h.id} sx={{ whiteSpace: 'nowrap' }}>
                    {h.isPlaceholder ? null : h.column.getCanSort() ? (
                      <TableSortLabel
                        active={!!h.column.getIsSorted()}
                        direction={h.column.getIsSorted() === 'asc' ? 'asc' : 'desc'}
                        onClick={h.column.getToggleSortingHandler()}
                        sx={{ color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600 }}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </TableSortLabel>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={32} />
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  <Typography color="text.secondary">{emptyMessage}</Typography>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover sx={{ cursor: 'pointer' }}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {totalPages && totalPages > 1 && (
        <Box display="flex" justifyContent="center" pt={2}>
          <Pagination
            count={totalPages}
            page={page ?? 1}
            onChange={(_, p) => onPageChange?.(p)}
            color="primary"
            size="small"
          />
        </Box>
      )}
    </Box>
  )
}
