'use server';

import { getServiceRoleClient } from '@/lib/supabase';
import { resyncGoogleSheets } from '@/lib/sheetsSync';
import { formatIDR, formatHolder } from '@/lib/utils';
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

// ----------------------------------------------------
// SAVING GOALS & CELENGAN IMPIAN ACTIONS
// ----------------------------------------------------

export async function createSavingGoal(payload: {
  name: string;
  target_amount: number;
  category: string;
  holder: string;
  target_date?: string | null;
  notes?: string | null;
  initial_amount?: number;
  payment_method_id?: string | null;
}) {
  const supabase = getServiceRoleClient();
  const initialAmount = Number(payload.initial_amount) || 0;

  const { data: goal, error } = await supabase
    .from('saving_goals')
    .insert([
      {
        name: payload.name.trim(),
        target_amount: Number(payload.target_amount),
        current_amount: initialAmount,
        category: payload.category || 'Lainnya',
        holder: payload.holder || 'Bersama',
        target_date: payload.target_date || null,
        notes: payload.notes?.trim() || null,
        status: initialAmount >= Number(payload.target_amount) ? 'completed' : 'active',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating saving goal:', error);
    return { success: false, error: error.message };
  }

  // If initial amount > 0, create a deposit log
  if (initialAmount > 0 && goal) {
    await supabase.from('saving_goal_logs').insert([
      {
        goal_id: goal.id,
        amount: initialAmount,
        type: 'deposit',
        holder: payload.holder || 'Bersama',
        payment_method_id: payload.payment_method_id || null,
        log_date: new Date().toISOString().split('T')[0],
        notes: 'Setoran Awal',
      },
    ]);
  }

  revalidatePath('/savings');
  revalidatePath('/');
  revalidatePath('/profile');
  resyncGoogleSheets().catch((err) => console.error('Auto-sync sheets error:', err));

  return { success: true, data: goal };
}

export async function updateSavingGoal(
  id: string,
  updates: {
    name?: string;
    target_amount?: number;
    category?: string;
    holder?: string;
    target_date?: string | null;
    notes?: string | null;
    status?: 'active' | 'completed' | 'paused';
  }
) {
  const supabase = getServiceRoleClient();
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) updateData.name = updates.name.trim();
  if (updates.target_amount !== undefined) updateData.target_amount = Number(updates.target_amount);
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.holder !== undefined) updateData.holder = updates.holder;
  if (updates.target_date !== undefined) updateData.target_date = updates.target_date || null;
  if (updates.notes !== undefined) updateData.notes = updates.notes?.trim() || null;
  if (updates.status !== undefined) updateData.status = updates.status;

  const { error } = await supabase
    .from('saving_goals')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Error updating saving goal:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/savings');
  revalidatePath('/');
  revalidatePath('/profile');
  resyncGoogleSheets().catch((err) => console.error('Auto-sync sheets error:', err));

  return { success: true };
}

export async function deleteSavingGoal(id: string) {
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();

  // Soft delete goal
  const { error } = await supabase
    .from('saving_goals')
    .update({ deleted_at: now })
    .eq('id', id);

  if (error) {
    return { success: false, error: error.message };
  }

  // Soft delete associated logs
  await supabase
    .from('saving_goal_logs')
    .update({ deleted_at: now })
    .eq('goal_id', id);

  revalidatePath('/savings');
  revalidatePath('/');
  revalidatePath('/profile');
  resyncGoogleSheets().catch((err) => console.error('Auto-sync sheets error:', err));

  return { success: true };
}

export async function depositToSavingGoal(payload: {
  goal_id: string;
  amount: number;
  holder: string;
  payment_method_id?: string | null;
  log_date?: string;
  notes?: string | null;
}) {
  const supabase = getServiceRoleClient();
  const depositAmount = Number(payload.amount);

  if (depositAmount <= 0) {
    return { success: false, error: 'Nominal setoran harus lebih dari 0' };
  }

  // Insert log
  const { error: logError } = await supabase.from('saving_goal_logs').insert([
    {
      goal_id: payload.goal_id,
      amount: depositAmount,
      type: 'deposit',
      holder: payload.holder || 'Bersama',
      payment_method_id: payload.payment_method_id || null,
      log_date: payload.log_date || new Date().toISOString().split('T')[0],
      notes: payload.notes?.trim() || null,
    },
  ]);

  if (logError) {
    console.error('Error recording deposit log:', logError);
    return { success: false, error: logError.message };
  }

  // Recalculate current amount from active logs
  const { data: logs } = await supabase
    .from('saving_goal_logs')
    .select('amount, type')
    .eq('goal_id', payload.goal_id)
    .is('deleted_at', null);

  const newCurrentAmount = (logs || []).reduce((acc, log) => {
    return log.type === 'deposit' ? acc + Number(log.amount) : acc - Number(log.amount);
  }, 0);

  // Check goal target
  const { data: goal } = await supabase
    .from('saving_goals')
    .select('target_amount, status')
    .eq('id', payload.goal_id)
    .single();

  const newStatus =
    goal && newCurrentAmount >= Number(goal.target_amount)
      ? 'completed'
      : goal?.status === 'completed'
      ? 'active'
      : goal?.status || 'active';

  await supabase
    .from('saving_goals')
    .update({
      current_amount: Math.max(0, newCurrentAmount),
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.goal_id);

  revalidatePath('/savings');
  revalidatePath('/');
  revalidatePath('/profile');
  resyncGoogleSheets().catch((err) => console.error('Auto-sync sheets error:', err));

  return { success: true };
}

export async function withdrawFromSavingGoal(payload: {
  goal_id: string;
  amount: number;
  holder: string;
  payment_method_id?: string | null;
  log_date?: string;
  notes?: string | null;
}) {
  const supabase = getServiceRoleClient();
  const withdrawAmount = Number(payload.amount);

  if (withdrawAmount <= 0) {
    return { success: false, error: 'Nominal penarikan harus lebih dari 0' };
  }

  // Check current amount
  const { data: currentGoal } = await supabase
    .from('saving_goals')
    .select('current_amount, target_amount')
    .eq('id', payload.goal_id)
    .single();

  if (!currentGoal || Number(currentGoal.current_amount) < withdrawAmount) {
    return { success: false, error: 'Saldo tabungan tidak mencukupi untuk penarikan ini' };
  }

  // Insert log
  const { error: logError } = await supabase.from('saving_goal_logs').insert([
    {
      goal_id: payload.goal_id,
      amount: withdrawAmount,
      type: 'withdraw',
      holder: payload.holder || 'Bersama',
      payment_method_id: payload.payment_method_id || null,
      log_date: payload.log_date || new Date().toISOString().split('T')[0],
      notes: payload.notes?.trim() || null,
    },
  ]);

  if (logError) {
    console.error('Error recording withdraw log:', logError);
    return { success: false, error: logError.message };
  }

  // Recalculate current amount from active logs
  const { data: logs } = await supabase
    .from('saving_goal_logs')
    .select('amount, type')
    .eq('goal_id', payload.goal_id)
    .is('deleted_at', null);

  const newCurrentAmount = (logs || []).reduce((acc, log) => {
    return log.type === 'deposit' ? acc + Number(log.amount) : acc - Number(log.amount);
  }, 0);

  const newStatus =
    newCurrentAmount >= Number(currentGoal.target_amount)
      ? 'completed'
      : 'active';

  await supabase
    .from('saving_goals')
    .update({
      current_amount: Math.max(0, newCurrentAmount),
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', payload.goal_id);

  revalidatePath('/savings');
  revalidatePath('/');
  revalidatePath('/profile');
  resyncGoogleSheets().catch((err) => console.error('Auto-sync sheets error:', err));

  return { success: true };
}

export async function deleteSavingGoalLog(logId: string, goalId: string) {
  const supabase = getServiceRoleClient();
  const now = new Date().toISOString();

  // Soft delete log
  const { error } = await supabase
    .from('saving_goal_logs')
    .update({ deleted_at: now })
    .eq('id', logId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Recalculate current amount
  const { data: logs } = await supabase
    .from('saving_goal_logs')
    .select('amount, type')
    .eq('goal_id', goalId)
    .is('deleted_at', null);

  const newCurrentAmount = (logs || []).reduce((acc, log) => {
    return log.type === 'deposit' ? acc + Number(log.amount) : acc - Number(log.amount);
  }, 0);

  const { data: goal } = await supabase
    .from('saving_goals')
    .select('target_amount')
    .eq('id', goalId)
    .single();

  const newStatus =
    goal && newCurrentAmount >= Number(goal.target_amount)
      ? 'completed'
      : 'active';

  await supabase
    .from('saving_goals')
    .update({
      current_amount: Math.max(0, newCurrentAmount),
      status: newStatus,
      updated_at: now,
    })
    .eq('id', goalId);

  revalidatePath('/savings');
  revalidatePath('/');
  revalidatePath('/profile');
  resyncGoogleSheets().catch((err) => console.error('Auto-sync sheets error:', err));

  return { success: true };
}

// ==================== ACCOUNT TRANSFER & RECONCILIATION ACTIONS ====================

export async function transferFunds(payload: {
  from_holder: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri';
  to_holder: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri';
  amount: number;
  trx_date: string;
  payment_method_id?: string | null;
  admin_fee?: number;
  description?: string;
}) {
  if (payload.from_holder === payload.to_holder) {
    return { success: false, error: 'Akun pengirim dan penerima tidak boleh sama' };
  }
  if (!payload.amount || Number(payload.amount) <= 0) {
    return { success: false, error: 'Nominal transfer harus lebih dari 0' };
  }

  const supabase = getServiceRoleClient();
  const transferDesc =
    payload.description?.trim() ||
    `Transfer: ${formatHolder(payload.from_holder)} → ${formatHolder(payload.to_holder)}`;

  // 1. Insert transfer record
  const { data: transferTrx, error: transferErr } = await supabase
    .from('transactions')
    .insert([
      {
        type: 'transfer',
        amount: Number(payload.amount),
        from_holder: payload.from_holder,
        holder: payload.to_holder,
        payment_method_id: payload.payment_method_id || null,
        trx_date: payload.trx_date,
        description: transferDesc,
      },
    ])
    .select()
    .single();

  if (transferErr) {
    console.error('Error recording transfer:', transferErr);
    return { success: false, error: transferErr.message };
  }

  // 2. Optional admin fee as expense mutation from from_holder
  if (payload.admin_fee && Number(payload.admin_fee) > 0) {
    let { data: adminCat } = await supabase
      .from('categories')
      .select('id')
      .eq('name', 'Biaya Admin')
      .eq('type', 'expense')
      .maybeSingle();

    if (!adminCat) {
      const { data: newCat } = await supabase
        .from('categories')
        .insert([{ name: 'Biaya Admin', type: 'expense', monthly_budget: 0 }])
        .select()
        .single();
      adminCat = newCat;
    }

    await supabase.from('transactions').insert([
      {
        type: 'expense',
        amount: Number(payload.admin_fee),
        holder: payload.from_holder,
        payment_method_id: payload.payment_method_id || null,
        category_id: adminCat?.id || null,
        trx_date: payload.trx_date,
        description: `Biaya Admin: ${transferDesc}`,
      },
    ]);
  }

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/accounts');
  revalidatePath('/profile');
  resyncGoogleSheets().catch((err) => console.error('Auto-sync sheets error:', err));

  return { success: true, data: transferTrx };
}

export async function reconcileAccountBalance(payload: {
  holder: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri';
  actual_balance: number;
  current_recorded_balance: number;
  reason: string;
  notes?: string;
  trx_date?: string;
  payment_method_id?: string | null;
}) {
  const diff = Number(payload.actual_balance) - Number(payload.current_recorded_balance);
  if (diff === 0) {
    return { success: false, error: 'Saldo riil sama dengan saldo tercatat (tidak ada selisih).' };
  }

  const supabase = getServiceRoleClient();
  const trxDate = payload.trx_date || new Date().toISOString().split('T')[0];
  const type = diff < 0 ? 'expense' : 'income';
  const amount = Math.abs(diff);

  // Find or create category 'Penyesuaian Saldo'
  let { data: cat } = await supabase
    .from('categories')
    .select('id')
    .eq('name', 'Penyesuaian Saldo')
    .eq('type', type)
    .maybeSingle();

  if (!cat) {
    const { data: newCat } = await supabase
      .from('categories')
      .insert([{ name: 'Penyesuaian Saldo', type, monthly_budget: 0 }])
      .select()
      .single();
    cat = newCat;
  }

  const formattedOld = formatIDR(payload.current_recorded_balance);
  const formattedNew = formatIDR(payload.actual_balance);
  const noteSuffix = payload.notes?.trim() ? ` • ${payload.notes.trim()}` : '';
  const description = `[Rekonsiliasi Saldo] ${payload.reason}${noteSuffix} (${formattedOld} → ${formattedNew})`;

  const { data: trx, error } = await supabase
    .from('transactions')
    .insert([
      {
        type,
        amount,
        holder: payload.holder,
        category_id: cat?.id || null,
        payment_method_id: payload.payment_method_id || null,
        trx_date: trxDate,
        description,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error reconciling balance:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/accounts');
  revalidatePath('/profile');
  resyncGoogleSheets().catch((err) => console.error('Auto-sync sheets error:', err));

  return { success: true, data: trx };
}


