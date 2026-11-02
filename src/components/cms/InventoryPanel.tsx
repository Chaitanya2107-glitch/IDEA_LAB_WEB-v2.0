// src/components/cms/InventoryPanel.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Package, Search, Edit2, Trash2, 
  CheckCircle, XCircle, AlertTriangle, Loader2, 
  Upload, FileSpreadsheet, ArrowLeft,
  Image as ImageIcon, Box, ReceiptText
} from "lucide-react";
import { InventoryItem } from "../../../types";
import { authService } from "../../services/api";
import { motion, AnimatePresence } from "framer-motion";

/* ==========================================================================
   SUB-COMPONENTS (Outside for stability)
   ========================================================================== */

const QuickStats: React.FC<{ items: InventoryItem[] }> = ({ items }) => {
  const totalValue = items.reduce((acc, curr) => {
    const val = (Number(curr.totalQuantity) || 0) * (Number(curr.costPerUnit) || 0);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);
  const criticalStock = items.filter(i => (Number(i.availableQuantity) || 0) < 5).length;
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {[
        { label: "Total Assets", val: items.length, icon: Box, color: "text-brand-600" },
        { label: "Inventory Value", val: `₹${totalValue.toLocaleString('en-IN')}`, icon: ReceiptText, color: "text-emerald-600" },
        { label: "Critical Stock", val: criticalStock, icon: AlertTriangle, color: criticalStock > 0 ? "text-red-500" : "text-slate-400" }
      ].map((s, i) => (
        <div key={i} className="group relative overflow-hidden bg-white px-6 py-8 border-b-2 border-slate-100 transition-all hover:border-brand-500">
          <div className="flex justify-between items-start mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{s.label}</p>
            <s.icon className={`w-5 h-5 ${s.color} opacity-20 group-hover:opacity-100 transition-opacity`} />
          </div>
          <p className="text-3xl font-light text-slate-900 tracking-tight">{s.val}</p>
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-slate-50 group-hover:bg-brand-500/10 transition-all" />
        </div>
      ))}
    </div>
  );
};

const ImportProgressOverlay: React.FC<{ show: boolean, queue: any[] }> = ({ show, queue }) => (
  <AnimatePresence>
    {show && (
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-white/90 backdrop-blur-md z-[200] flex items-center justify-center p-6"
      >
        <div className="w-full max-w-xl bg-white border border-slate-100 shadow-2xl p-8">
          <div className="flex justify-between items-center mb-10">
            <div>
              <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.4em] mb-2">System Processing</p>
              <h2 className="text-2xl font-light text-slate-900 tracking-tight">Bulk Asset Registry</h2>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Global Status</p>
              <p className="text-xl font-light text-slate-900">{queue.filter(q => q.status === 'success' || q.status === 'fail').length}/{queue.length}</p>
            </div>
          </div>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
            {queue.map((item, i) => (
              <div key={i} className="group relative bg-white border border-slate-50 p-6 transition-all hover:border-slate-100">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">{item.name}</p>
                    <div className="flex items-center gap-2">
                      {item.status === 'loading' && <Loader2 className="w-3 h-3 text-brand-600 animate-spin" />}
                      {item.status === 'success' && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                      {item.status === 'fail' && <XCircle className="w-3 h-3 text-red-500" />}
                      <p className={`text-[9px] font-medium uppercase tracking-tight ${item.status === 'fail' ? 'text-red-500' : 'text-slate-900'}`}>
                        {item.status === 'pending' && 'Queued'}
                        {item.status === 'loading' && 'Processing...'}
                        {item.status === 'success' && 'Registry Complete'}
                        {item.status === 'fail' && 'Registry Error'}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs font-light text-slate-400">{item.progress}%</p>
                </div>
                
                <div className="w-full h-[3px] bg-slate-50 relative overflow-hidden">
                  <motion.div 
                    className={`absolute top-0 left-0 h-full ${item.status === 'fail' ? 'bg-red-500' : 'bg-brand-600'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${item.progress}%` }}
                    transition={{ type: "spring", stiffness: 50 }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-10 pt-6 border-t border-slate-50 flex justify-between items-center">
            <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Protocol: AICTE-IDEA-LAB-REGISTRY-v2.0</p>
            <div className="flex gap-2">
              <div className="w-2 h-2 rounded-full bg-brand-600 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-slate-200" />
              <div className="w-2 h-2 rounded-full bg-slate-200" />
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ==========================================================================
   MAIN PANEL
   ========================================================================== */

const InventoryPanel: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<InventoryItem> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importQueue, setImportQueue] = useState<{name: string, status: string, progress: number}[]>([]);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const inv = await authService.getInventory();
      
      // Normalize snake_case from API to camelCase for the frontend state
      const normalized = (inv || []).map((item: any) => ({
        ...item,
        totalQuantity: item.totalQuantity !== undefined ? item.totalQuantity : (item.total_quantity ?? 0),
        availableQuantity: item.availableQuantity !== undefined ? item.availableQuantity : (item.available_quantity ?? 0),
        costPerUnit: item.costPerUnit !== undefined ? item.costPerUnit : (item.cost_per_unit ?? 0),
        billNumber: item.billNumber !== undefined ? item.billNumber : (item.bill_number ?? ""),
        purchaseOrder: item.purchaseOrder !== undefined ? item.purchaseOrder : (item.purchase_order ?? ""),
        purchaseDate: item.purchaseDate !== undefined ? item.purchaseDate : (item.purchase_date ?? ""),
        imageUrl: item.imageUrl !== undefined ? item.imageUrl : (item.image_url ?? ""),
        asset_id: item.asset_id ?? item.assetId ?? "",
        room_no: item.room_no ?? item.roomNo ?? "",
        is_rentable: item.is_rentable ?? item.isRentable ?? false,
      }));
      
      setItems(normalized);
    } catch (err) {
      console.error("Failed to load inventory data", err);
    } finally {
      setLoading(false);
    }
  };

  /** Upload Thumbnail */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { publicUrl } = await authService.uploadFile('projects', file, 'inventory');
      setEditingItem(prev => ({ ...prev, image_url: publicUrl ?? undefined }));
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };  /** Bulk Import Logic with High-Precision Mapping */
  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) return;

      const parseCSVLine = (line: string) => {
        const result = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, ""));
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim().replace(/^"|"$/g, ""));
        return result;
      };

      const rawHeaders = parseCSVLine(lines[0]);
      // Remove UTF-8 BOM if present and trim
      const headers = rawHeaders.map(h => h.replace(/^\uFEFF/, "").toLowerCase().trim());
      
      const findIdx = (keywords: string[]) => 
        headers.findIndex(h => keywords.some(k => h === k.toLowerCase() || h.includes(k.toLowerCase())));

      // Specific Index overrides based on user's exact file structure detected
      const idx = {
        name: findIdx(['itemname', 'item name', 'name']),
        date: findIdx(['purchasedate', 'purchase date', 'date']),
        qty: findIdx(['quantity', 'qty']),
        // Prioritize 'total' for price calculation
        totalPrice: findIdx(['total', 'invoice amount', 'net amount']), 
        unitPrice: findIdx(['price', 'unit price', 'unitprice', 'cost']),
        type: findIdx(['itemtype', 'item type', 'type']),
        location: findIdx(['location']),
        room: findIdx(['room no', 'room number', 'room#', 'room name']),
        category: findIdx(['category', 'itemsgroupcode']),
        asset_id: findIdx(['itemcode', 'asset id', 'asset_id'])
      };

      // Collect ALL price columns for fallback if primary matches have no data
      const allPriceIdxs = headers.map((h, i) => 
        (h.includes('price') || h.includes('cost') || h.includes('total')) ? i : -1
      ).filter(i => i !== -1);

      const allQtyIdxs = headers.map((h, i) => 
        (h.includes('quantity') || h.includes('qty')) ? i : -1
      ).filter(i => i !== -1);

      const cleanNum = (val: any) => {
        if (!val || val === "") return 0;
        // Handle numbers with commas or currency symbols
        const cleaned = val.toString().replace(/[^0-9.]/g, '');
        return parseFloat(cleaned) || 0;
      };

      const normalizeDate = (d: string) => {
        if (!d || d.toLowerCase().includes('not available')) return null;
        const parts = d.split(/[./-]/);
        if (parts.length === 3) {
          // If first part is > 31, it's likely YYYY-MM-DD
          if (parseInt(parts[0]) > 31) return d.replace(/[./]/g, '-');
          // Otherwise assume DD-MM-YYYY
          const day = parts[0].padStart(2, '0');
          const month = parts[1].padStart(2, '0');
          const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
          return `${year}-${month}-${day}`;
        }
        return d;
      };

      const dataItems = lines.slice(1).map(line => {
        const parts = parseCSVLine(line);
        const name = idx.name !== -1 ? parts[idx.name] : parts[0];
        if (!name || name.trim() === "") return null;

        // Qty Fallback: Cycle through all Qty-like columns until we find a non-zero number
        let totalQty = 0;
        if (idx.qty !== -1) totalQty = cleanNum(parts[idx.qty]);
        if (totalQty === 0) {
          for (const qIdx of allQtyIdxs) {
            const val = cleanNum(parts[qIdx]);
            if (val > 0) { totalQty = val; break; }
          }
        }
        if (totalQty === 0) totalQty = 1; // Default to 1 if still 0
        
        // Price Fallback: Cycle through Total and Price columns
        let totalVal = idx.totalPrice !== -1 ? cleanNum(parts[idx.totalPrice]) : 0;
        let unitVal = idx.unitPrice !== -1 ? cleanNum(parts[idx.unitPrice]) : 0;

        // If primary values are zero, try any column that looks like a price
        if (totalVal === 0 && unitVal === 0) {
          for (const pIdx of allPriceIdxs) {
            const val = cleanNum(parts[pIdx]);
            if (val > 0) {
              // Guess if it's total (larger than 1000 and Qty > 1 typically)
              if (val > 500 && totalQty > 1) totalVal = val;
              else unitVal = val;
              if (totalVal > 0 || unitVal > 0) break;
            }
          }
        }

        let unitCost = 0;
        if (totalVal > 0) {
          unitCost = totalQty > 0 ? totalVal / totalQty : totalVal;
        } else {
          unitCost = unitVal;
        }

        // Build Description from "rest of the data"
        const extraData: string[] = [];
        parts.forEach((val, i) => {
          // If this column isn't one of our primary mapped fields, add to description
          const isMapped = Object.values(idx).includes(i);
          if (!isMapped && val && val.trim() && val !== "0") {
            extraData.push(`${rawHeaders[i]}: ${val}`);
          }
        });

        return {
          asset_id: idx.asset_id !== -1 && parts[idx.asset_id] ? parts[idx.asset_id] : `AST-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
          name: name.trim(),
          category: idx.category !== -1 ? (parts[idx.category] || "General") : "General",
          totalQuantity: totalQty,
          availableQuantity: totalQty, // as per requirement: both equal as default
          costPerUnit: unitCost,
          type: idx.type !== -1 ? (parts[idx.type] || 'component').toLowerCase() : 'component',
          location: idx.location !== -1 ? parts[idx.location] : "Main Lab",
          room_no: idx.room !== -1 ? parts[idx.room] : "",
          purchaseDate: idx.date !== -1 ? normalizeDate(parts[idx.date]) : null,
          specification: extraData.join(' | '),
          status: 'operational',
          unit: "Units",
          is_rentable: false
        };
      }).filter(item => item !== null);

      if (dataItems.length === 0) {
        alert("No valid rows detected.");
        return;
      }

      if (confirm(`Refined Mapping: Detected ${dataItems.length} items with ${rawHeaders.length} data points. Import?`)) {
        setShowImportProgress(true);
        setImportQueue(dataItems.map(item => ({ name: item!.name, status: 'pending', progress: 0 })));
        
        let successCount = 0;
        for (let i = 0; i < dataItems.length; i++) {
          const item = dataItems[i];
          setImportQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'loading', progress: 30 } : q));
          try {
            await authService.addInventoryItem(item as any);
            successCount++;
            setImportQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'success', progress: 100 } : q));
          } catch (err) {
            setImportQueue(prev => prev.map((q, idx) => idx === i ? { ...q, status: 'fail', progress: 100 } : q));
          }
        }
        
        setTimeout(() => {
          setShowImportProgress(false);
          loadData();
          alert(`Registry Sync Complete. Success: ${successCount}`);
        }, 1500);
      }
    };
    reader.readAsText(file);
  };
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingItem || !editingItem.name) return;

    const cleanStrNum = (v: any) => {
      if (typeof v === 'number') return v;
      if (!v || v === "") return 0;
      return parseFloat(v.toString().replace(/[^0-9.]/g, '')) || 0;
    };

    try {
      setUploading(true);
      const payload = {
        name: editingItem.name || "",
        category: editingItem.category || "General",
        type: editingItem.type || "component",
        totalQuantity: cleanStrNum(editingItem.totalQuantity),
        availableQuantity: cleanStrNum(editingItem.availableQuantity),
        costPerUnit: cleanStrNum(editingItem.costPerUnit),
        location: editingItem.location || "Main Lab",
        room_no: editingItem.room_no || "",
        status: editingItem.status || "operational",
        is_rentable: !!editingItem.is_rentable,
        image_url: editingItem.image_url || null,
        specification: editingItem.specification || "",
        brand: editingItem.brand || "",
        asset_id: editingItem.asset_id || "",
        billNumber: editingItem.billNumber || "",
        purchaseOrder: editingItem.purchaseOrder || "",
        purchaseDate: editingItem.purchaseDate || "",
        unit: editingItem.unit || "Units",
        updated_at: new Date().toISOString()
      };

      if (editingItem.id) {
        await authService.updateInventoryItem(editingItem.id, payload);
      } else {
        await authService.addInventoryItem(payload);
      }
      setIsEditing(false);
      loadData();
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await authService.deleteInventoryItem(id);
      loadData();
    } catch (err) {
      alert("Failed to delete item");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;
    
    try {
      setLoading(true);
      await authService.bulkDeleteInventoryItems(selectedIds);
      setSelectedIds([]);
      loadData();
    } catch (err) {
      alert("Failed to delete multiple items");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(i => i.id));
    }
  };

  const downloadInventory = (mode: 'all' | 'filtered') => {
    const dataSource = mode === 'all' ? items : filteredItems;
    if (dataSource.length === 0) return;
    
    const headers = ["ItemCode", "ItemName", "ItemsGroupCode", "Quantity", "Bill Number/Invoice", "Purchase order", "Price", "Total", "Date"];
    const rows = dataSource.map(item => [
      item.asset_id || "",
      item.name,
      item.category,
      item.totalQuantity,
      item.billNumber || "",
      item.purchaseOrder || "",
      item.costPerUnit,
      (item.totalQuantity || 0) * (item.costPerUnit || 0),
      item.purchaseDate || "",
      item.location || "",
      item.room_no || ""
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(","),
      ...rows.map(r => r.map(v => typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory_export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredItems = useMemo(() => items.filter(item => {
    try {
      const s = search.toLowerCase();
      const n = (item.name || "").toLowerCase();
      const c = (item.category || "").toLowerCase();
      const a = (item.asset_id || "").toLowerCase();
      const filterMatch = filter === "All" || item.category === filter;
      return (n.includes(s) || c.includes(s) || a.includes(s)) && filterMatch;
    } catch {
      return false;
    }
  }), [items, search, filter]);

  const categories = useMemo(() => ["All", ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))], [items]);

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div className="min-h-screen">
      <ImportProgressOverlay show={showImportProgress} queue={importQueue} />
      <AnimatePresence mode="wait">
        {!isEditing ? (
          <motion.div 
            key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-12 pb-20"
          >
            {/* Header section */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-slate-100 pb-10">
              <div>
                <p className="text-[10px] font-black text-brand-600 uppercase tracking-[0.3em] mb-2">Resource Management</p>
                <h1 className="text-5xl font-light text-slate-900 tracking-tighter">Inventory</h1>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => downloadInventory('all')} className="flex items-center gap-2.5 px-6 py-3 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all">
                  <FileSpreadsheet className="w-4 h-4" /> Export CSV
                </button>
                <button onClick={() => bulkInputRef.current?.click()} className="flex items-center gap-2.5 px-6 py-3 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-900 hover:text-white transition-all">
                  <Upload className="w-4 h-4" /> Bulk Import
                  <input type="file" ref={bulkInputRef} className="hidden" accept=".csv" onChange={handleBulkImport} />
                </button>
                <button 
                  onClick={() => { setEditingItem({}); setIsEditing(true); }}
                  className="px-8 py-3 bg-brand-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-700 transition-all shadow-lg shadow-brand-500/20"
                >
                  Add Asset
                </button>
              </div>
            </div>

            <QuickStats items={items} />

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-6 py-4 border-b border-slate-50">
              <div className="relative flex-1 group w-full">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-brand-500" />
                <input 
                  type="text" placeholder="SEARCH ASSETS..."
                  className="w-full pl-8 py-4 bg-transparent border-none outline-none text-[11px] font-black uppercase tracking-widest placeholder:text-slate-300"
                  value={search} onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-6 w-full sm:w-auto overflow-x-auto no-scrollbar">
                {selectedIds.length > 0 && (
                  <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all">
                    <Trash2 className="w-3.5 h-3.5" /> Delete {selectedIds.length}
                  </button>
                )}
                {categories.map(c => (
                  <button key={c} onClick={() => setFilter(c)}
                    className={`whitespace-nowrap text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:text-brand-600 ${filter === c ? 'text-brand-600 border-b-2 border-brand-600 pb-1' : 'text-slate-400'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-6 w-10">
                      <input type="checkbox" checked={filteredItems.length > 0 && selectedIds.length === filteredItems.length} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-200 text-brand-600 focus:ring-brand-500" />
                    </th>
                    <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Asset Detail</th>
                    <th className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Classification</th>
                    <th className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Stock</th>
                    <th className="px-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Value</th>
                    <th className="pr-6 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Settings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredItems.map(item => (
                    <tr key={item.id} className={`group hover:bg-slate-50/50 transition-colors ${selectedIds.includes(item.id) ? 'bg-slate-50' : ''}`}>
                      <td className="py-8">
                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds(p => p.includes(item.id) ? p.filter(x => x !== item.id) : [...p, item.id])} className="w-4 h-4 rounded border-slate-200 text-brand-600 focus:ring-brand-500" />
                      </td>
                      <td className="px-4 py-8">
                        <div className="flex items-center gap-6">
                           <div className="relative w-14 h-14 bg-slate-50 flex items-center justify-center overflow-hidden grayscale group-hover:grayscale-0 transition-all">
                            {item.image_url ? <img src={item.image_url} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-200" />}
                           </div>
                           <div>
                             <p className="text-sm font-medium text-slate-900 tracking-tight">{item.name}</p>
                             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-0.5">{item.asset_id || "UNASSIGNED"}</p>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-8">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 inline-block">{item.category}</p>
                        <p className="text-[9px] font-medium text-slate-400 mt-2 block capitalize tracking-wide">{item.location} {item.room_no ? `• ${item.room_no}` : ''}</p>
                      </td>
                      <td className="px-6 py-8">
                        <div className="flex flex-col items-center gap-2">
                           <p className={`text-sm font-medium ${Number(item.availableQuantity) < 5 ? 'text-red-500' : 'text-slate-900'}`}>{item.availableQuantity} / {item.totalQuantity} <span className="text-[10px] text-slate-400 font-normal">{item.unit || 'Units'}</span></p>
                           <div className="w-20 h-0.5 bg-slate-100 relative">
                             <div className={`absolute top-0 left-0 h-full ${Number(item.availableQuantity) < 5 ? 'bg-red-500' : 'bg-brand-600'}`} style={{ width: `${Math.min(100, ((Number(item.availableQuantity) || 0) / (Number(item.totalQuantity) || 1)) * 100)}%` }} />
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-8 text-right">
                        <p className="text-sm font-medium">₹{((Number(item.totalQuantity) || 0) * (Number(item.costPerUnit) || 0)).toLocaleString('en-IN')}</p>
                        <p className="text-[9px] font-medium text-slate-400 uppercase tracking-widest mt-1">₹{(Number(item.costPerUnit) || 0).toLocaleString('en-IN')}/{item.unit || 'Unit'}</p>
                      </td>
                      <td className="pr-6 py-8">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button onClick={() => { setEditingItem(item); setIsEditing(true); }} className="p-2.5 border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-900 transition-all"><Edit2 className="w-4 h-4" /></button>
                           <button onClick={() => handleDelete(item.id)} className="p-2.5 border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-600 transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed inset-0 bg-white z-[100] overflow-y-auto"
          >
            <div className="max-w-screen-xl mx-auto px-10 py-16">
              <div className="flex items-center justify-between mb-20 border-b border-slate-100 pb-10">
                <button onClick={() => setIsEditing(false)} className="flex items-center gap-3 text-slate-400 hover:text-slate-900 transition-all group">
                  <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em]">Exit Editor</span>
                </button>
                <div className="flex items-center gap-6">
                  <button onClick={() => handleSave()} className="px-12 py-4 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] hover:bg-brand-600 transition-all active:scale-95 shadow-2xl shadow-slate-200">
                    Authorize Changes
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-24">
                <div className="lg:col-span-4 space-y-12">
                   <div className="group relative w-full aspect-square bg-slate-50 flex items-center justify-center border border-slate-100 overflow-hidden">
                      {editingItem?.image_url ? <img src={editingItem.image_url} className="w-full h-full object-cover" /> : <ImageIcon className="w-10 h-10 text-slate-100" />}
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-all">
                         <p className="text-[10px] font-black text-white uppercase tracking-widest">Rewrite Image</p>
                      </button>
                   </div>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                   <div className="space-y-6 pt-12 border-t border-slate-100">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Technical Specs & Description</p>
                     <textarea 
                        className="w-full bg-transparent border-none outline-none text-slate-600 tracking-tight leading-relaxed placeholder:text-slate-200 min-h-[160px] resize-none border-b border-transparent focus:border-slate-100"
                        placeholder="ENTER DETAILED TECHNICAL SPECIFICATIONS OR DESCRIPTION..."
                        value={editingItem?.specification || ""} onChange={e => setEditingItem({...editingItem, specification: e.target.value})} 
                      />
                   </div>
                </div>

                <div className="lg:col-span-8">
                   <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-12">
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name</label>
                        <input required className="w-full bg-transparent outline-none py-2 text-xl font-light text-slate-900"
                          value={editingItem?.name || ""} onChange={e => setEditingItem({...editingItem, name: e.target.value})} />
                      </div>
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset ID</label>
                        <input className="w-full bg-transparent outline-none py-2 text-xl font-light text-slate-900"
                          value={editingItem?.asset_id || ""} onChange={e => setEditingItem({...editingItem, asset_id: e.target.value})} />
                      </div>
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                        <input required className="w-full bg-transparent outline-none py-2 text-xl font-light text-slate-900"
                          value={editingItem?.category || ""} onChange={e => setEditingItem({...editingItem, category: e.target.value})} />
                      </div>
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Price</label>
                        <input required step="0.01" className="w-full bg-transparent outline-none py-2 text-xl font-light text-slate-900"
                          value={editingItem?.costPerUnit ?? ""} onChange={e => setEditingItem({...editingItem, costPerUnit: e.target.value as any})} />
                      </div>
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Qty</label>
                        <input required className="w-full bg-transparent outline-none py-2 text-xl font-light text-slate-900"
                          value={editingItem?.totalQuantity ?? ""} 
                          onChange={e => {
                            const val = e.target.value;
                            const prevTotal = editingItem?.totalQuantity || 0;
                            const prevAvail = editingItem?.availableQuantity || 0;
                            if (Number(prevTotal) === Number(prevAvail)) {
                              setEditingItem({...editingItem, totalQuantity: val as any, availableQuantity: val as any});
                            } else {
                              setEditingItem({...editingItem, totalQuantity: val as any});
                            }
                          }} 
                        />
                      </div>
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Available Qty</label>
                        <input required className="w-full bg-transparent outline-none py-2 text-xl font-light text-slate-900"
                          value={editingItem?.availableQuantity ?? ""} onChange={e => setEditingItem({...editingItem, availableQuantity: e.target.value as any})} />
                      </div>
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                        <input className="w-full bg-transparent outline-none py-2 text-xl font-light text-slate-900"
                          value={editingItem?.location || ""} onChange={e => setEditingItem({...editingItem, location: e.target.value})} />
                      </div>
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Room No</label>
                        <input className="w-full bg-transparent outline-none py-2 text-xl font-light text-slate-900"
                          value={editingItem?.room_no || ""} onChange={e => setEditingItem({...editingItem, room_no: e.target.value})} />
                      </div>
                      <div className="space-y-2 border-b border-slate-100 pb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Type</label>
                        <input className="w-full bg-transparent outline-none py-2 text-xl font-light text-slate-900"
                          value={editingItem?.unit || ""} onChange={e => setEditingItem({...editingItem, unit: e.target.value})} />
                      </div>
                      <div className="md:col-span-2 pt-12 flex items-center justify-between border-t border-slate-100 mt-6">
                         <div>
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Authorize for Student Rental</p>
                            <p className="text-[9px] font-medium text-slate-400 mt-1 uppercase">Request protocol encryption enabled</p>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={editingItem?.is_rentable || false} onChange={e => setEditingItem({...editingItem, is_rentable: e.target.checked})} />
                            <div className="w-14 h-6 bg-slate-100 rounded-full peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-1 after:left-[4px] after:bg-white after:rounded-full after:h-4 after:w-6 after:transition-all peer-checked:bg-slate-900"></div>
                          </label>
                      </div>
                   </form>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InventoryPanel;
