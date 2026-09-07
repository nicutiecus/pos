import React, { useState, useEffect, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {type ColDef, type ValueFormatterParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import api from '../../api/axiosInstance';

interface GLEntry {
  id: number;
  date: string;
  reference_id: string;
  description: string;
  branch_name: string | null;
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  balance: number;
}

interface Account {
  id: number;
  name: string;
  code: string;
}

const GeneralLedger: React.FC = () => {
  const [rowData, setRowData] = useState<GLEntry[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Default to the current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedAccount, setSelectedAccount] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchLedgerData();
  }, [startDate, endDate, selectedAccount]);

  const fetchFilters = async () => {
    try {
      const res = await api.get('/accounting/accounts/');
      setAccounts(res.data);
    } catch (err) {
      console.error("Failed to load accounts for filter", err);
    }
  };

  const fetchLedgerData = async () => {
    setIsLoading(true);
    try {
      let url = `/accounting/general-ledger/?start_date=${startDate}&end_date=${endDate}`;
      if (selectedAccount !== 'All') {
        url += `&account_id=${selectedAccount}`;
      }

      const res = await api.get(url);
      
      let runningBalance = 0;
      const processedData = res.data.map((row: any) => {
        const debit = Number(row.debit);
        const credit = Number(row.credit);
        // Note: In a mixed-account GL, a simple Dr - Cr running balance is shown. 
        // If filtered to a specific account, it reflects the period's net movement.
        runningBalance += (debit - credit); 
        
        return {
          ...row,
          debit,
          credit,
          balance: runningBalance
        };
      });

      setRowData(processedData);
    } catch (err) {
      console.error("Failed to load General Ledger data", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Derive unique branches from the fetched ledger data for the filter dropdown
  const uniqueBranches = useMemo(() => {
    const branches = new Set(rowData.map(r => r.branch_name).filter(Boolean));
    return Array.from(branches) as string[];
  }, [rowData]);

  const currencyFormatter = (params: ValueFormatterParams) => {
    if (!params.value || params.value === 0) return '-';
    return `₦${params.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const columnDefs: ColDef<GLEntry>[] = [
    { field: 'date', headerName: 'Date', width: 120, sortable: true, filter: true },
    { field: 'reference_id', headerName: 'Ref', width: 130, sortable: true, filter: true },
    { 
      headerName: 'Account', 
      valueGetter: (p) => `${p.data?.account_code} - ${p.data?.account_name}`,
      width: 200, 
      sortable: true, 
      filter: true 
    },
    { field: 'description', headerName: 'Description', flex: 1, sortable: true, filter: true },
    { 
      field: 'debit', 
      headerName: 'Debit', 
      width: 140, 
      type: 'numericColumn', 
      valueFormatter: currencyFormatter,
      cellStyle: { fontWeight: 'bold', color: '#374151' }
    },
    { 
      field: 'credit', 
      headerName: 'Credit', 
      width: 140, 
      type: 'numericColumn', 
      valueFormatter: currencyFormatter,
      cellStyle: { fontWeight: 'bold', color: '#374151' }
    },
    { 
      field: 'balance', 
      headerName: 'Balance', 
      width: 150, 
      type: 'numericColumn', 
      valueFormatter: currencyFormatter,
      cellStyle: { fontWeight: '900', color: '#111827' }
    },
  ];

  const gridData = useMemo(() => {
    return rowData.filter(row => {
      const matchesBranch = selectedBranch === 'All' || row.branch_name === selectedBranch;
      const matchesSearch = 
        row.reference_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesBranch && matchesSearch;
    });
  }, [rowData, selectedBranch, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 h-full flex flex-col">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-2xl font-black text-gray-800 tracking-tight mb-4">General Ledger</h2>
        
        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1">Branch</label>
            <select 
              value={selectedBranch} 
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500 bg-white"
            >
              <option value="All">All Branches</option>
              {uniqueBranches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1">Account</label>
            <select 
              value={selectedAccount} 
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500 bg-white"
            >
              <option value="All">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1">Search</label>
            <input 
              type="text" 
              placeholder="Ref or description..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* AG Grid Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 min-h-[600px] overflow-hidden p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-gray-500 font-medium">
            Loading Ledger Data...
          </div>
        ) : (
          <div className="ag-theme-alpine h-full w-full">
            <AgGridReact
              rowData={gridData}
              columnDefs={columnDefs}
              animateRows={true}
              rowSelection="single"
              pagination={true}
              paginationPageSize={50}
              defaultColDef={{
                resizable: true,
                sortable: true,
                filter: true,
              }}
              overlayNoRowsTemplate="<span class='text-gray-500'>No journal entries found for this period.</span>"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default GeneralLedger;