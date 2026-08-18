'use server';

import { getServiceRoleClient } from '@/lib/supabase';
import { resyncGoogleSheets } from '@/lib/sheetsSync';
import { revalidatePath } from 'next/cache';

export async function addCategory(name: string, type: 'income' | 'expense') {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('categories')
    .insert([{ name, type }])
    .select()
    .single();

  if (error) {
    console.error('Error adding category:', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/categories');
  return { success: true, data };
}

export async function updateCategory(id: string, name: string) {
  const supabase = getServiceRoleClient();
  const { data, error } = await supabase
    .from('categories')
    .update({ name })
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

