'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Edit2, Trash2, Loader2, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addCategory, updateCategory, deleteCategory } from '@/app/actions';
import { useToast } from '@/components/Toast';
import { Category } from '@/lib/types';

export default function Categories() {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'income' | 'expense'>('expense');

  // Edit modal state
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [editCatName, setEditCatName] = useState('');

  // Delete modal state
  const [deleteCategoryItem, setDeleteCategoryItem] = useState<Category | null>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (data) setCategories(data as Category[]);
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
      setCategories([...categories, result.data as Category]);
      setShowAddModal(false);
      setNewCatName('');
      showToast('Kategori berhasil ditambahkan', 'success');
    } else {
      showToast('Gagal menambahkan kategori: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory || !editCatName.trim()) return;

    setIsSubmitting(true);
    const result = await updateCategory(editCategory.id, editCatName.trim());

    if (result.success) {
      await fetchCategories();
      setEditCategory(null);
      setEditCatName('');
      showToast('Kategori berhasil diperbarui & disinkronkan', 'success');
    } else {
      showToast('Gagal memperbarui kategori: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCategoryItem) return;

    setIsSubmitting(true);
    const result = await deleteCategory(deleteCategoryItem.id);

    if (result.success) {
      await fetchCategories();
      setDeleteCategoryItem(null);
      showToast('Kategori berhasil dihapus', 'success');
    } else {
      showToast('Gagal menghapus kategori: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const openEditModal = (cat: Category) => {
    setEditCategory(cat);
    setEditCatName(cat.name);
  };

  const incomes = categories.filter((c) => c.type === 'income');
  const expenses = categories.filter((c) => c.type === 'expense');

  return (
    <main className="min-h-screen p-5 pt-8 relative pb-28">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">Kelola Kategori</h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-2 bg-primary/20 text-primary rounded-full hover:bg-primary/30 transition-colors flex items-center gap-1 px-3 text-xs font-semibold"
        >
          <Plus size={16} /> Tambah
        </button>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Income Categories */}
          <section>
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-1">
              Pemasukan ({incomes.length})
            </h2>
            <div className="glass-panel rounded-2xl divide-y divide-foreground/5 dark:divide-white/5 overflow-hidden">
              {incomes.length === 0 ? (
                <div className="p-4 text-sm text-text-muted text-center">Belum ada kategori pemasukan.</div>
              ) : (
                incomes.map((cat) => (
                  <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-foreground/5 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Tag size={15} className="text-income" />
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-2 text-text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors"
                        title="Edit Kategori"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteCategoryItem(cat)}
                        className="p-2 text-expense/70 hover:text-expense rounded-lg hover:bg-expense/10 transition-colors"
                        title="Hapus Kategori"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Expense Categories */}
          <section>
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-1">
              Pengeluaran ({expenses.length})
            </h2>
            <div className="glass-panel rounded-2xl divide-y divide-foreground/5 dark:divide-white/5 overflow-hidden">
              {expenses.length === 0 ? (
                <div className="p-4 text-sm text-text-muted text-center">Belum ada kategori pengeluaran.</div>
              ) : (
                expenses.map((cat) => (
                  <div key={cat.id} className="p-4 flex items-center justify-between hover:bg-foreground/5 dark:hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Tag size={15} className="text-expense" />
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-2 text-text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors"
                        title="Edit Kategori"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteCategoryItem(cat)}
                        className="p-2 text-expense/70 hover:text-expense rounded-lg hover:bg-expense/10 transition-colors"
                        title="Hapus Kategori"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Tambah Kategori Baru</h2>

            <form onSubmit={handleAddCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Tipe Kategori</label>
                <div className="flex bg-surface-light p-1 rounded-xl border border-foreground/5 dark:border-white/5">
                  <button
                    type="button"
                    onClick={() => setNewCatType('expense')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      newCatType === 'expense' ? 'bg-expense text-white shadow-md' : 'text-text-muted hover:text-foreground'
                    }`}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCatType('income')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      newCatType === 'income' ? 'bg-income text-white shadow-md' : 'text-text-muted hover:text-foreground'
                    }`}
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
                  className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-text-muted/50 text-foreground"
                  placeholder="Cth: Belanja Harian"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl mt-2 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Kategori'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Modal */}
      {editCategory && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button
              onClick={() => setEditCategory(null)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Edit Kategori</h2>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Nama Kategori</label>
                <input
                  type="text"
                  value={editCatName}
                  onChange={(e) => setEditCatName(e.target.value)}
                  className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all text-foreground"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl mt-2 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Perubahan & Sync Sheets'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Modal */}
      {deleteCategoryItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <h2 className="text-lg font-bold mb-2">Hapus Kategori</h2>
            <p className="text-sm text-text-muted mb-6">
              Apakah Anda yakin ingin menghapus kategori <span className="font-bold text-foreground">&quot;{deleteCategoryItem.name}&quot;</span>?
            </p>

            <div className="space-y-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="w-full bg-expense/10 text-expense border border-expense/20 hover:bg-expense/20 font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Ya, Hapus Kategori'}
              </button>
              <button
                onClick={() => setDeleteCategoryItem(null)}
                className="w-full text-text-muted hover:text-foreground py-2 text-sm font-semibold"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
