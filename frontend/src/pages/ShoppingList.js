import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Check, X } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Sidebar from '@/components/Sidebar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function ShoppingList({ user }) {
  const [items, setItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const fetchItems = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/shopping`, { credentials: 'include' });
      const data = await res.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch shopping items:', error);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BACKEND_URL}/api/shopping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newItem })
      });
      setShowAddItem(false);
      setNewItem('');
      fetchItems();
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const handleUpdateItem = async (itemId, status) => {
    try {
      await fetch(`${BACKEND_URL}/api/shopping/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      fetchItems();
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const pendingItems = items.filter(i => i.status === 'pending');
  const approvedItems = items.filter(i => i.status === 'approved');
  const purchasedItems = items.filter(i => i.status === 'purchased');

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar user={user} isOpen={sidebarOpen} setIsOpen={setSidebarOpen} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      
      <main className={`flex-1 overflow-y-auto transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6" data-testid="shopping-list">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl lg:text-3xl font-black text-white">Shopping List</h1>
              <p className="text-sm text-slate-400">{approvedItems.length} items to buy</p>
            </div>
            <button
              onClick={() => setShowAddItem(true)}
              className="bg-primary hover:bg-primary/80 active:scale-95 text-white p-3 lg:p-2 rounded-full transition-all neon-glow w-full sm:w-auto"
              data-testid="add-item-button"
            >
              <Plus className="w-5 h-5 lg:w-6 lg:h-6 mx-auto sm:mx-0" />
            </button>
          </header>

        {user?.role === 'parent' && pendingItems.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">Pending Approval</h2>
            {pendingItems.map(item => (
              <div key={item.item_id} className="glass-card rounded-2xl p-4 flex items-center justify-between" data-testid="pending-item">
                <div>
                  <p className="font-bold text-white">{item.name}</p>
                  <p className="text-xs text-slate-400">Requested by {item.requested_by}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleUpdateItem(item.item_id, 'approved')}
                    className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full transition-all"
                    data-testid="approve-item-button"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleUpdateItem(item.item_id, 'rejected')}
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transition-all"
                    data-testid="reject-item-button"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white">To Buy</h2>
          {approvedItems.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Shopping list is empty!</p>
            </div>
          ) : (
            approvedItems.map(item => (
              <div key={item.item_id} className="glass-card rounded-2xl p-4 flex items-center justify-between" data-testid="shopping-item">
                <p className="font-medium text-white">{item.name}</p>
                {user?.role === 'parent' && (
                  <button
                    onClick={() => handleUpdateItem(item.item_id, 'purchased')}
                    className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-full text-sm font-bold transition-all"
                    data-testid="mark-purchased-button"
                  >
                    Mark Purchased
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {purchasedItems.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-white">Recently Purchased</h2>
            {purchasedItems.map(item => (
              <div key={item.item_id} className="glass-card rounded-2xl p-4 opacity-50" data-testid="purchased-item">
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-green-400" />
                  <p className="font-medium text-white line-through">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </main>

      {showAddItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" data-testid="add-item-modal">
          <div className="glass-card rounded-3xl p-6 max-w-md w-full">
            <h2 className="text-2xl font-black text-white mb-4">Add Item</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <input
                type="text"
                placeholder="Item name"
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600"
                required
                data-testid="item-name-input"
              />
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/80 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="submit-item-button"
                >
                  Add Item
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddItem(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-full transition-all"
                  data-testid="cancel-item-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <BottomNav userRole={user?.role} />
    </div>
  );
}