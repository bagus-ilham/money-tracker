'use server';

import { getServiceRoleClient } from '@/lib/supabase';
import { resyncGoogleSheets } from '@/lib/sheetsSync';
import { revalidatePath } from 'next/cache';

export async function addCategory(name: string, type: 'income' | 'expense', monthly_budget: number = 0) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('categories')
    .insert([{ name, type, monthly_budget: Number(monthly_budget) || 0 }])
    .select()
    .single();

  if (error) {
    console.error('Error adding category:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/categories');
  revalidatePath('/');
  return { success: true, data };
}

export async function updateCategory(id: string, name: string, monthly_budget?: number) {
  const supabase = getServiceRoleClient();
  const updatePayload: Record<string, any> = { name };
  if (monthly_budget !== undefined) {
    updatePayload.monthly_budget = Number(monthly_budget) || 0;
  }

  const { data, error } = await supabase
    .from('categories')
    .update(updatePayload)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating category:', error);
    return { success: false, error: error.message };
  }

  // Trigger Google Sheets resync so updated category name reflects on all transactions in Sheets
  await resyncGoogleSheets();

  revalidatePath('/categories');
  revalidatePath('/history');
  revalidatePath('/');
  return { success: true, data };
}

export async function setCategoryBudget(id: string, monthly_budget: number) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('categories')
    .update({ monthly_budget: Math.max(0, Number(monthly_budget) || 0) })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error setting category budget:', error);
    return { success: false, error: error.message };
  }

  // Resync to Google Sheets so Ringkasan reflects updated budget
  await resyncGoogleSheets();

  revalidatePath('/categories');
  revalidatePath('/');
  return { success: true, data };
}

export async function deleteCategory(id: string) {
  const supabase = getServiceRoleClient();
  
  // Detach category from any active transactions before deleting to prevent foreign key errors
  await supabase
    .from('transactions')
    .update({ category_id: null })
    .eq('category_id', id);

  const { data, error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error deleting category:', error);
    return { success: false, error: error.message };
  }

  // Trigger Google Sheets resync so deleted category references are updated in Sheets
  await resyncGoogleSheets();

  revalidatePath('/categories');
  revalidatePath('/history');
  revalidatePath('/');
  return { success: true, data };
}

// Payment Methods Server Actions
export async function addPaymentMethod(name: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('payment_methods')
    .insert([{ name }])
    .select()
    .single();

  if (error) {
    console.error('Error adding payment method:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/payment-methods');
  revalidatePath('/add');
  return { success: true, data };
}

export async function updatePaymentMethod(id: string, name: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('payment_methods')
    .update({ name })
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating payment method:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/payment-methods');
  revalidatePath('/add');
  revalidatePath('/history');
  return { success: true, data };
}

export async function deletePaymentMethod(id: string) {
  const supabase = getServiceRoleClient();

  // Detach payment method from any active transactions
  await supabase
    .from('transactions')
    .update({ payment_method_id: null })
    .eq('payment_method_id', id);

  const { data, error } = await supabase
    .from('payment_methods')
    .delete()
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error deleting payment method:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/payment-methods');
  revalidatePath('/add');
  revalidatePath('/history');
  return { success: true, data };
}

export async function addTransaction(formData: {
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  holder: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri';
  from_holder?: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri';
  category_id?: string;
  payment_method_id?: string;
  trx_date: string;
  description?: string;
}) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('transactions')
    .insert([formData])
    .select();

  if (error) {
    console.error('Error adding transaction:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/history');
  
  return { success: true, data };
}

export async function deleteTransaction(id: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error deleting transaction:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/history');
  
  return { success: true, data };
}

export async function updateTransaction(id: string, formData: Partial<{
  amount: number;
  category_id: string | null;
  payment_method_id: string | null;
  holder: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri';
  from_holder: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri' | null;
  trx_date: string;
  description: string;
}>) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('transactions')
    .update(formData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating transaction:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/history');
  
  return { success: true, data };
}

// ==================== LOANS & DEBT / RECEIVABLE ACTIONS ====================

export async function addLoan(formData: {
  type: 'receivable' | 'payable';
  person_name: string;
  total_amount: number;
  holder: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri';
  payment_method_id?: string;
  loan_date: string;
  due_date?: string;
  description?: string;
  recordTransaction?: boolean;
}) {
  const supabase = getServiceRoleClient();

  const { data: loan, error } = await supabase
    .from('loans')
    .insert([
      {
        type: formData.type,
        person_name: formData.person_name.trim(),
        total_amount: formData.total_amount,
        paid_amount: 0,
        holder: formData.holder,
        payment_method_id: formData.payment_method_id || null,
        loan_date: formData.loan_date,
        due_date: formData.due_date || null,
        description: formData.description?.trim() || null,
        status: 'unpaid',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding loan:', error);
    return { success: false, error: error.message };
  }

  // Optionally record physical cash mutation to transactions table
  if (formData.recordTransaction !== false) {
    // Find category for loan
    const catType = formData.type === 'receivable' ? 'expense' : 'income';
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', 'Pinjaman')
      .eq('type', catType)
      .maybeSingle();

    await supabase.from('transactions').insert([
      {
        type: formData.type === 'receivable' ? 'expense' : 'income',
        amount: formData.total_amount,
        holder: formData.holder,
        payment_method_id: formData.payment_method_id || null,
        category_id: cat?.id || null,
        trx_date: formData.loan_date,
        description: `[${formData.type === 'receivable' ? 'Piutang' : 'Hutang'}] ${formData.person_name.trim()}${
          formData.description ? ` • ${formData.description.trim()}` : ''
        }`,
      },
    ]);
  }

  revalidatePath('/loans');
  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/categories');
  return { success: true, data: loan };
}

export async function addLoanPayment(formData: {
  loan_id: string;
  amount: number;
  payment_date: string;
  holder: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri';
  payment_method_id?: string;
  notes?: string;
  recordTransaction?: boolean;
}) {
  const supabase = getServiceRoleClient();

  // 1. Fetch loan
  const { data: loan, error: loanFetchErr } = await supabase
    .from('loans')
    .select('*')
    .eq('id', formData.loan_id)
    .single();

  if (loanFetchErr || !loan) {
    return { success: false, error: 'Pinjaman tidak ditemukan' };
  }

  // 2. Insert payment
  const { data: payment, error: pmtErr } = await supabase
    .from('loan_payments')
    .insert([
      {
        loan_id: formData.loan_id,
        amount: formData.amount,
        payment_date: formData.payment_date,
        holder: formData.holder,
        payment_method_id: formData.payment_method_id || null,
        notes: formData.notes?.trim() || null,
      },
    ])
    .select()
    .single();

  if (pmtErr) {
    console.error('Error adding loan payment:', pmtErr);
    return { success: false, error: pmtErr.message };
  }

  // 3. Update loan paid_amount and status
  const newPaidAmount = Number(loan.paid_amount) + Number(formData.amount);
  const newStatus =
    newPaidAmount >= Number(loan.total_amount)
      ? 'paid'
      : newPaidAmount > 0
      ? 'partially_paid'
      : 'unpaid';

  await supabase
    .from('loans')
    .update({
      paid_amount: newPaidAmount,
      status: newStatus,
    })
    .eq('id', formData.loan_id);

  // 4. Optionally record to transactions table
  if (formData.recordTransaction !== false) {
    const isReceivable = loan.type === 'receivable';
    // If receivable (they pay us back), cash enters (income: Pelunasan Piutang)
    // If payable (we pay them back), cash leaves (expense: Pelunasan Hutang)
    const targetCatName = isReceivable ? 'Pelunasan Piutang' : 'Tagihan';
    const targetType = isReceivable ? 'income' : 'expense';

    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', targetCatName)
      .maybeSingle();

    await supabase.from('transactions').insert([
      {
        type: targetType,
        amount: formData.amount,
        holder: formData.holder,
        payment_method_id: formData.payment_method_id || null,
        category_id: cat?.id || null,
        trx_date: formData.payment_date,
        description: `Cicilan ${isReceivable ? 'Piutang' : 'Hutang'}: ${loan.person_name}${
          formData.notes ? ` • ${formData.notes.trim()}` : ''
        }`,
      },
    ]);
  }

  revalidatePath('/loans');
  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/categories');
  return { success: true, data: payment };
}

export async function deleteLoan(id: string) {
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();

  // Soft delete loan
  const { error } = await supabase
    .from('loans')
    .update({ deleted_at: now })
    .eq('id', id);

  if (error) {
    console.error('Error deleting loan:', error);
    return { success: false, error: error.message };
  }

  // Soft delete payments
  await supabase
    .from('loan_payments')
    .update({ deleted_at: now })
    .eq('loan_id', id);

  revalidatePath('/loans');
  revalidatePath('/');
  revalidatePath('/history');
  return { success: true };
}

export async function deleteLoanPayment(paymentId: string, loanId: string) {
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();

  // Soft delete payment
  const { error } = await supabase
    .from('loan_payments')
    .update({ deleted_at: now })
    .eq('id', paymentId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Recalculate remaining payments
  const { data: remainingPayments } = await supabase
    .from('loan_payments')
    .select('amount')
    .eq('loan_id', loanId)
    .is('deleted_at', null);

  const totalPaid = (remainingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);

  const { data: loan } = await supabase
    .from('loans')
    .select('total_amount')
    .eq('id', loanId)
    .single();

  if (loan) {
    const newStatus =
      totalPaid >= Number(loan.total_amount)
        ? 'paid'
        : totalPaid > 0
        ? 'partially_paid'
        : 'unpaid';

    await supabase
      .from('loans')
      .update({
        paid_amount: totalPaid,
        status: newStatus,
      })
      .eq('id', loanId);
  }

  revalidatePath('/loans');
  revalidatePath('/');
  return { success: true };
}


