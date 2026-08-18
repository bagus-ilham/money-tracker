'use server';

import { getServiceRoleClient } from '@/lib/supabase';
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
  
  return { success: true, data };
}

export async function addTransaction(formData: {
  type: 'income' | 'expense' | 'transfer',
  amount: number,
  holder: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri',
  from_holder?: 'cash_suami' | 'atm_suami' | 'cash_istri' | 'atm_istri' | 'suami' | 'istri',
  category_id?: string,
  trx_date: string,
  description?: string
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

  // Trigger revalidation so dashboard updates immediately
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
  amount: number,
  category_id: string,
  trx_date: string,
  description: string
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
