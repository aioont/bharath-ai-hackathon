import { useState, useEffect } from 'react'
import axios from 'axios'
import { API_BASE_URL } from '@/utils/constants'
import { Database, Search, ChevronLeft, ChevronRight, Loader2, RefreshCw } from 'lucide-react'

// Simple specific Axios instance for admin
const adminApi = axios.create({
  baseURL: API_BASE_URL,
})

export default function AdminTables() {
  const [tables, setTables] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [tableData, setTableData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(0)
  const limit = 50

  useEffect(() => {
    fetchTables()
  }, [])

  useEffect(() => {
    if (selectedTable) {
      fetchTableData(selectedTable, 0)
    }
  }, [selectedTable])

  const fetchTables = async () => {
    try {
      setLoading(true)
      const res = await adminApi.get('/api/admin/db/tables')
      setTables(res.data.tables || [])
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tables')
    } finally {
      setLoading(false)
    }
  }

  const fetchTableData = async (tableName: string, newPage: number) => {
    try {
      setLoading(true)
      const offset = newPage * limit
      const res = await adminApi.get(`/api/admin/db/tables/${tableName}?limit=${limit}&offset=${offset}`)
      setTableData(res.data)
      setPage(newPage)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to fetch table data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Sidebar - Table List */}
      <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-white flex justify-between items-center">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Database size={18} className="text-indigo-500" /> Tables
          </h2>
          <button onClick={fetchTables} className="p-1 hover:bg-gray-100 rounded text-gray-500">
            <RefreshCw size={14} className={loading && !selectedTable ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tables.map(table => (
            <button
              key={table}
              onClick={() => setSelectedTable(table)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedTable === table 
                  ? 'bg-indigo-50 text-indigo-700 font-medium border border-indigo-100' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {table}
            </button>
          ))}
          {tables.length === 0 && !loading && (
            <div className="text-center p-4 text-sm text-gray-500">No tables found</div>
          )}
        </div>
      </div>

      {/* Main Content - Table Data */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 text-red-600 border-b border-red-100 text-sm">
            {error}
          </div>
        )}

        {!selectedTable ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Database size={48} className="mb-4 opacity-20" />
            <p>Select a table to view its data</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{selectedTable}</h2>
                {tableData && (
                  <p className="text-xs text-gray-500 mt-1">
                    Showing {tableData.offset + 1}-{Math.min(tableData.offset + limit, tableData.total)} of {tableData.total} rows
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => fetchTableData(selectedTable, page)}
                  className="p-1.5 hover:bg-gray-100 rounded text-gray-500 mr-2"
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button 
                    onClick={() => fetchTableData(selectedTable, Math.max(0, page - 1))}
                    disabled={page === 0 || loading}
                    className="p-1 rounded bg-white shadow-sm disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-medium px-2 text-gray-600">
                    Page {page + 1}
                  </span>
                  <button 
                     onClick={() => fetchTableData(selectedTable, page + 1)}
                     disabled={!tableData || tableData.offset + limit >= tableData.total || loading}
                     className="p-1 rounded bg-white shadow-sm disabled:opacity-50"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto bg-gray-50 relative">
              {loading && !tableData && (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
                  <Loader2 className="animate-spin text-indigo-500" size={32} />
                </div>
              )}
              
              {tableData && tableData.data && (
                <div className="min-w-max">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr>
                        {tableData.columns.map((col: any) => (
                          <th 
                            key={col.column_name} 
                            className="sticky top-0 z-10 bg-gray-100 text-gray-600 text-xs font-semibold px-4 py-3 border-b border-gray-200 border-r last:border-r-0 whitespace-nowrap"
                          >
                            {col.column_name}
                            <span className="block text-[10px] text-gray-400 font-normal">{col.data_type}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.data.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-indigo-50/30 border-b border-gray-200 last:border-0 bg-white">
                          {tableData.columns.map((col: any) => {
                            const val = row[col.column_name]
                            // Format complex objects
                            let displayVal = val
                            if (val === null) displayVal = <span className="text-gray-300 italic">null</span>
                            else if (typeof val === 'boolean') displayVal = <span className={val ? "text-green-600 font-medium" : "text-red-500"}>{val.toString()}</span>
                            else if (typeof val === 'object') displayVal = <span className="text-gray-500 text-[10px] bg-gray-100 p-1 rounded font-mono break-all">{JSON.stringify(val).substring(0, 50)}{JSON.stringify(val).length > 50 ? '...' : ''}</span>
                            else if (col.data_type.includes('timestamp')) displayVal = new Date(val).toLocaleString()
                            
                            return (
                              <td key={`${i}-${col.column_name}`} className="px-4 py-2 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 max-w-xs truncate overflow-hidden" title={typeof val === 'string' ? val : ''}>
                                {displayVal}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                      {tableData.data.length === 0 && (
                        <tr>
                          <td colSpan={tableData.columns.length} className="px-4 py-8 text-center text-gray-500 text-sm bg-white">
                            No records found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}