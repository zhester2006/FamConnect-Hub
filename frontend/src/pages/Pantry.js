import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Package, Plus, Search, AlertTriangle, Camera, Trash2, X, Upload, Loader2, ArrowDown, ShoppingCart, Clock, Tag } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const CATEGORIES = [
  { id: 'all', name: 'All Items', icon: Package },
  { id: 'fridge', name: 'Fridge', icon: Package },
  { id: 'freezer', name: 'Freezer', icon: Package },
  { id: 'shelf', name: 'Pantry Shelf', icon: Package },
  { id: 'spices', name: 'Spices', icon: Package },
  { id: 'beverages', name: 'Beverages', icon: Package },
  { id: 'produce', name: 'Fresh Produce', icon: Package },
  { id: 'other', name: 'Other', icon: Package }
];

const CATEGORY_COLORS = {
  fridge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  freezer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  shelf: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  spices: 'bg-red-500/20 text-red-400 border-red-500/30',
  beverages: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  produce: 'bg-green-500/20 text-green-400 border-green-500/30',
  other: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
};

export default function Pantry({ user }) {
  const [items, setItems] = useState([]);
  const [alerts, setAlerts] = useState({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'shelf', quantity: '', unit: '', expiration_date: '' });
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('dev_session_token');
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }, []);

  const fetchPantry = useCallback(() => {
    const url = filter !== 'all' ? `${BACKEND_URL}/api/pantry?category=${filter}` : `${BACKEND_URL}/api/pantry`;
    fetch(url, { credentials: 'include', headers: getHeaders() })
      .then(r => r.json())
      .then(data => {
        setItems(data.items || []);
        setAlerts(data.alerts || {});
      }).catch(() => {});
  }, [getHeaders, filter]);

  useEffect(() => { fetchPantry(); }, [fetchPantry]);

  const handleAdd = () => {
    if (!newItem.name.trim()) { toast.error('Item name required'); return; }
    fetch(`${BACKEND_URL}/api/pantry`, {
      method: 'POST', headers: getHeaders(), credentials: 'include',
      body: JSON.stringify(newItem)
    }).then(r => { if (r.ok) { toast.success('Added to pantry'); setShowAdd(false); setNewItem({ name: '', category: 'shelf', quantity: '', unit: '', expiration_date: '' }); fetchPantry(); }
    }).catch(() => toast.error('Failed'));
  };

  const handleDelete = (itemId) => {
    fetch(`${BACKEND_URL}/api/pantry/${itemId}`, { method: 'DELETE', headers: getHeaders(), credentials: 'include' })
      .then(() => { toast.success('Removed'); fetchPantry(); }).catch(() => toast.error('Failed'));
  };

  const handleLowStock = (itemId) => {
    fetch(`${BACKEND_URL}/api/pantry/${itemId}/low-stock`, { method: 'PUT', headers: getHeaders(), credentials: 'include' })
      .then(r => r.json())
      .then(d => { toast.success(d.message); fetchPantry(); }).catch(() => toast.error('Failed'));
  };

  const handleScanImage = async (imageFile) => {
    setScanning(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const res = await fetch(`${BACKEND_URL}/api/pantry/scan`, {
        method: 'POST', headers: getHeaders(), credentials: 'include',
        body: JSON.stringify({ image: base64, scan_type: 'receipt' })
      });

      if (res.ok) {
        const data = await res.json();
        const foundItems = data.items || [];
        if (foundItems.length > 0) {
          setScannedItems(foundItems);
          toast.success(`Found ${foundItems.length} items!`);
        } else {
          toast.error('No items detected. Try a clearer photo.');
        }
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Scan failed');
      }
    } catch (e) {
      toast.error('Scan failed. Try again.');
    }
    setScanning(false);
  };

  const handleAddScannedItems = () => {
    fetch(`${BACKEND_URL}/api/pantry/bulk`, {
      method: 'POST', headers: getHeaders(), credentials: 'include',
      body: JSON.stringify({ items: scannedItems })
    }).then(r => r.json()).then(d => {
      toast.success(d.message || 'Items added!');
      setScannedItems([]);
      setShowScan(false);
      fetchPantry();
    }).catch(() => toast.error('Failed'));
  };

  const today = new Date().toISOString().split('T')[0];
  const soon = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];

  const filteredItems = items.filter(item => {
    if (search) {
      return item.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  const groupedItems = {};
  filteredItems.forEach(item => {
    const cat = item.category || 'other';
    if (!groupedItems[cat]) groupedItems[cat] = [];
    groupedItems[cat].push(item);
  });

  const totalAlerts = (alerts.expired || 0) + (alerts.expiring_soon || 0) + (alerts.low_stock || 0);

  return (
    <div className="flex h-screen relative">
      <div className="fixed inset-0 bg-gradient-to-br from-green-900/20 via-slate-950 to-amber-900/20 pointer-events-none" />
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      <main className={`flex-1 overflow-y-auto transition-all duration-300 relative z-10 ${sidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        <div className="p-4 pt-16 md:pt-4 lg:p-6 lg:pt-6 pb-24 md:pb-6 space-y-4" data-testid="pantry-page">
          <header className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl lg:text-2xl font-black text-white flex items-center gap-2">
                <Package className="w-6 h-6 text-green-400" /> Kitchen Pantry
              </h1>
              <p className="text-sm text-slate-400">{items.length} items tracked</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowScan(true)} className="bg-accent hover:bg-accent/80 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2" data-testid="scan-btn">
                <Camera className="w-4 h-4" /> Scan
              </button>
              <button onClick={() => setShowAdd(true)} className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2" data-testid="add-item-btn">
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </div>
          </header>

          {/* Alerts Banner */}
          {totalAlerts > 0 && (
            <div className="glass-card rounded-xl p-3 border border-yellow-500/30 bg-yellow-500/5 flex items-center gap-3" data-testid="pantry-alerts">
              <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
              <div className="flex gap-4 text-sm">
                {alerts.expired > 0 && <span className="text-red-400 font-bold">{alerts.expired} expired</span>}
                {alerts.expiring_soon > 0 && <span className="text-yellow-400 font-bold">{alerts.expiring_soon} expiring soon</span>}
                {alerts.low_stock > 0 && <span className="text-orange-400 font-bold">{alerts.low_stock} low stock</span>}
              </div>
            </div>
          )}

          {/* Search + Category Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input type="text" placeholder="Search pantry..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 text-sm focus:border-primary focus:outline-none"
                data-testid="pantry-search" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setFilter(cat.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    filter === cat.id ? 'bg-primary text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                  }`} data-testid={`filter-${cat.id}`}>
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Pantry Items Grid */}
          {filteredItems.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-white mb-2">Pantry is Empty</h2>
              <p className="text-slate-400 text-sm">Add items manually or scan a receipt!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([cat, catItems]) => {
                const colorClass = CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;
                const catName = CATEGORIES.find(c => c.id === cat)?.name || cat;
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg border ${colorClass}`}>{catName}</span>
                      <span className="text-xs text-slate-500">{catItems.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {catItems.map(item => {
                        const isExpired = item.expiration_date && item.expiration_date < today;
                        const isExpiring = item.expiration_date && !isExpired && item.expiration_date <= soon;
                        return (
                          <div key={item.item_id} className={`glass-card rounded-xl p-3 flex items-center gap-3 group ${
                            isExpired ? 'border border-red-500/30 bg-red-500/5' : isExpiring ? 'border border-yellow-500/30 bg-yellow-500/5' : ''
                          }`} data-testid={`pantry-item-${item.item_id}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{item.name}</p>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                {item.quantity && <span>{item.quantity} {item.unit}</span>}
                                {item.expiration_date && (
                                  <span className={isExpired ? 'text-red-400' : isExpiring ? 'text-yellow-400' : ''}>
                                    <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                                    {isExpired ? 'Expired' : isExpiring ? 'Expiring soon' : `Exp: ${item.expiration_date}`}
                                  </span>
                                )}
                                {item.low_stock && <span className="text-orange-400 font-bold">Low Stock</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleLowStock(item.item_id)} title="Toggle low stock"
                                className={`p-1.5 rounded-lg transition-all ${item.low_stock ? 'bg-orange-500/20 text-orange-400' : 'hover:bg-orange-500/20 text-slate-500 hover:text-orange-400'}`}>
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDelete(item.item_id)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-500 hover:text-red-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add Item Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white">Add Pantry Item</h2>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Item name" value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:outline-none" autoFocus data-testid="pantry-item-name" />
              <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none" data-testid="pantry-item-category">
                {CATEGORIES.filter(c => c.id !== 'all').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Quantity" value={newItem.quantity} onChange={e => setNewItem({...newItem, quantity: e.target.value})}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none" />
                <input type="text" placeholder="Unit (lbs, oz, ct)" value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Expiration Date (optional)</label>
                <input type="date" value={newItem.expiration_date} onChange={e => setNewItem({...newItem, expiration_date: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none" />
              </div>
              <button onClick={handleAdd} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl" data-testid="submit-pantry-item">
                Add to Pantry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Modal */}
      {showScan && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card rounded-2xl p-5 max-w-md w-full max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-white flex items-center gap-2"><Camera className="w-5 h-5 text-accent" /> Smart Scanner</h2>
              <button onClick={() => { setShowScan(false); setScannedItems([]); }} className="p-1 hover:bg-slate-800 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
            </div>

            {scannedItems.length === 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Take a photo or upload an image of a receipt, product label, or pantry shelf.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => cameraInputRef.current?.click()} disabled={scanning}
                    className="flex flex-col items-center gap-2 p-6 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all" data-testid="scan-camera-btn">
                    <Camera className="w-8 h-8 text-accent" />
                    <span className="text-sm text-white font-bold">Camera</span>
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} disabled={scanning}
                    className="flex flex-col items-center gap-2 p-6 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl transition-all" data-testid="scan-upload-btn">
                    <Upload className="w-8 h-8 text-primary" />
                    <span className="text-sm text-white font-bold">Upload</span>
                  </button>
                </div>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => e.target.files[0] && handleScanImage(e.target.files[0])} />
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files[0] && handleScanImage(e.target.files[0])} />
                {scanning && (
                  <div className="text-center py-4">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                    <p className="text-sm text-slate-400">AI is analyzing your image...</p>
                  </div>
                )}
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 font-bold mb-1">TIPS FOR BEST RESULTS</p>
                  <ul className="text-[10px] text-slate-400 space-y-1">
                    <li>- Hold receipt flat with good lighting</li>
                    <li>- For products, capture the label clearly</li>
                    <li>- Works with receipts, cans, boxes, bottles</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                  <p className="text-sm text-green-400 font-bold">Found {scannedItems.length} items!</p>
                  <p className="text-xs text-slate-400">Review and add to your pantry</p>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {scannedItems.map((item, idx) => {
                    const colorClass = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.other;
                    return (
                      <div key={idx} className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-3">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-white">{item.name}</p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${colorClass}`}>{item.category}</span>
                            {item.quantity && <span className="text-[10px] text-slate-400">{item.quantity}</span>}
                          </div>
                        </div>
                        <button onClick={() => setScannedItems(scannedItems.filter((_, i) => i !== idx))} className="p-1 text-slate-500 hover:text-red-400">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setScannedItems([])} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-xl font-bold">Scan Again</button>
                  <button onClick={handleAddScannedItems} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2" data-testid="add-scanned-items">
                    <ArrowDown className="w-4 h-4" /> Add All to Pantry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
