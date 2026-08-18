'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addCategory } from '@/app/actions';

type Category = {
  id: string;
  name: string;
  type: 'income' | 'expense';
};

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
      
    if (data) setCategories(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setIsSubmitting(true);
    const result = await addCategory(newCatName.trim(), newCatType);

    if (result.success && result.data) {
      setCategories([...categories, result.data]);
      setShowAddModal(false);
      setNewCatName('');
    } else {
      alert('Gagal menambahkan kategori: ' + (result.error || 'Unknown error'));
    }
    setIsSubmitting(false);
  };

  const incomes = categories.filter(c => c.type === 'income');
  const expenses = categories.filter(c => c.type === 'expense');

  return (
    <main className="min-h-screen p-5 pt-8 relative">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">Kelola Kategori</h1>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors"
        >
          <Plus size={20} />
        </button>
      </header>

      {isLoading ? (
        <div className="text-center py-10 text-text-muted text-sm">Memuat...</div>
      ) : (
        <div className="space-y-6 pb-28">
          <section>
            <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Pemasukan</h2>
            <div className="glass-panel rounded-2xl divide-y divide-white/5">
              {incomes.length === 0 ? (
                <div className="p-4 text-sm text-text-muted">Belum ada kategori pemasukan.</div>
              ) : (
                incomes.map((cat) => (
                  <div key={cat.id} className="p-4 text-sm font-medium">{cat.name}</div>
                ))
              )}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Pengeluaran</h2>
            <div className="glass-panel rounded-2xl divide-y divide-white/5">
              {expenses.length === 0 ? (
                <div className="p-4 text-sm text-text-muted">Belum ada kategori pengeluaran.</div>
              ) : (
                expenses.map((cat) => (
                  <div key={cat.id} className="p-4 text-sm font-medium">{cat.name}</div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-white"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Tambah Kategori Baru</h2>
            
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Tipe Kategori</label>
                <div className="flex bg-surface-light p-1 rounded-xl">
                  <button 
                    type="button"
                    onClick={() => setNewCatType('expense')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${newCatType === 'expense' ? 'bg-expense text-white shadow-md' : 'text-text-muted'}`}
                  >
                    Pengeluaran
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewCatType('income')}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${newCatType === 'income' ? 'bg-income text-white shadow-md' : 'text-text-muted'}`}
                  >
                    Pemasukan
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Nama Kategori</label>
                <input 
                  type="text" 
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-text-muted/50"
                  placeholder="Cth: Belanja Harian"
                  required
                  autoFocus
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl mt-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Menyimpan...' : 'Simpan Kategori'}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
