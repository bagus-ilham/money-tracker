'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, X, Edit2, Trash2, Loader2, CreditCard } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addPaymentMethod, updatePaymentMethod, deletePaymentMethod } from '@/app/actions';
import { useToast } from '@/components/Toast';
import { PaymentMethod } from '@/lib/types';

export default function PaymentMethods() {
  const { showToast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');

  // Edit modal state
  const [editMethod, setEditMethod] = useState<PaymentMethod | null>(null);
  const [editMethodName, setEditMethodName] = useState('');

  // Delete modal state
  const [deleteMethodItem, setDeleteMethodItem] = useState<PaymentMethod | null>(null);

  const fetchMethods = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .order('name');

    if (data) setMethods(data as PaymentMethod[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethodName.trim()) return;

    setIsSubmitting(true);
    const result = await addPaymentMethod(newMethodName.trim());

    if (result.success && result.data) {
      setMethods([...methods, result.data as PaymentMethod]);
      setShowAddModal(false);
      setNewMethodName('');
      showToast('Metode pembayaran berhasil ditambahkan', 'success');
    } else {
      showToast('Gagal menambahkan metode pembayaran: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMethod || !editMethodName.trim()) return;

    setIsSubmitting(true);
    const result = await updatePaymentMethod(editMethod.id, editMethodName.trim());

    if (result.success) {
      await fetchMethods();
      setEditMethod(null);
      setEditMethodName('');
      showToast('Metode pembayaran berhasil diperbarui', 'success');
    } else {
      showToast('Gagal memperbarui metode pembayaran: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteMethodItem) return;

    setIsSubmitting(true);
    const result = await deletePaymentMethod(deleteMethodItem.id);

    if (result.success) {
      await fetchMethods();
      setDeleteMethodItem(null);
      showToast('Metode pembayaran berhasil dihapus', 'success');
    } else {
      showToast('Gagal menghapus metode pembayaran: ' + (result.error || 'Terjadi kesalahan'), 'error');
    }
    setIsSubmitting(false);
  };

  const openEditModal = (method: PaymentMethod) => {
    setEditMethod(method);
    setEditMethodName(method.name);
  };

  return (
    <main className="min-h-screen p-5 pt-8 relative pb-28">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/profile" className="p-2 -ml-2 rounded-full hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">Metode Pembayaran</h1>
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
          <section>
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 ml-1">
              Daftar Metode ({methods.length})
            </h2>
            <div className="glass-panel rounded-2xl divide-y divide-foreground/5 dark:divide-white/5 overflow-hidden">
              {methods.length === 0 ? (
                <div className="p-4 text-sm text-text-muted text-center py-8">
                  Belum ada metode pembayaran. Klik tombol Tambah untuk membuat baru.
                </div>
              ) : (
                methods.map((method) => (
                  <div
                    key={method.id}
                    className="p-4 flex items-center justify-between hover:bg-foreground/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 text-primary rounded-xl">
                        <CreditCard size={16} />
                      </div>
                      <span className="text-sm font-medium">{method.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(method)}
                        className="p-2 text-text-muted hover:text-foreground rounded-lg hover:bg-foreground/5 dark:hover:bg-white/10 transition-colors"
                        title="Edit Metode"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteMethodItem(method)}
                        className="p-2 text-expense/70 hover:text-expense rounded-lg hover:bg-expense/10 transition-colors"
                        title="Hapus Metode"
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

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Tambah Metode Pembayaran</h2>

            <form onSubmit={handleAddMethod} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Nama Metode</label>
                <input
                  type="text"
                  value={newMethodName}
                  onChange={(e) => setNewMethodName(e.target.value)}
                  className="w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary transition-all placeholder:text-text-muted/50 text-foreground"
                  placeholder="Cth: Cash, Transfer BCA, QRIS, GoPay"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl mt-2 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Metode'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editMethod && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <button
              onClick={() => setEditMethod(null)}
              className="absolute top-5 right-5 p-2 bg-surface-light rounded-full text-text-muted hover:text-foreground"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold mb-5">Edit Metode Pembayaran</h2>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Nama Metode</label>
                <input
                  type="text"
                  value={editMethodName}
                  onChange={(e) => setEditMethodName(e.target.value)}
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
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Simpan Perubahan'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteMethodItem && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-safe-area bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-surface border border-foreground/10 dark:border-white/10 rounded-3xl p-6 shadow-2xl relative animate-in slide-in-from-bottom-10">
            <h2 className="text-lg font-bold mb-2">Hapus Metode Pembayaran</h2>
            <p className="text-sm text-text-muted mb-6">
              Apakah Anda yakin ingin menghapus metode <span className="font-bold text-foreground">&quot;{deleteMethodItem.name}&quot;</span>?
            </p>

            <div className="space-y-3">
              <button
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="w-full bg-expense/10 text-expense border border-expense/20 hover:bg-expense/20 font-bold py-3.5 rounded-xl transition-colors flex justify-center items-center gap-2"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Ya, Hapus'}
              </button>
              <button
                onClick={() => setDeleteMethodItem(null)}
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
