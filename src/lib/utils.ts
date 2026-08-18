import { HolderAccount } from './types';

export const HOLDER_OPTIONS: { value: HolderAccount; label: string }[] = [
  { value: 'cash_suami', label: 'Cash Suami' },
  { value: 'atm_suami', label: 'ATM Suami' },
  { value: 'cash_istri', label: 'Cash Istri' },
  { value: 'atm_istri', label: 'ATM Istri' },
];

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatNumberWithSeparators(value: number | string): string {
  if (!value && value !== 0) return '';
  const numStr = value.toString().replace(/\D/g, '');
  if (!numStr) return '';
  return new Intl.NumberFormat('id-ID').format(parseInt(numStr, 10));
}

export function parseFormattedNumber(value: string): number {
  const clean = value.replace(/\D/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

export function formatHolder(h?: string | null): string {
  if (!h) return '';
  switch (h) {
    case 'cash_suami':
    case 'suami':
      return 'Cash Suami';
    case 'atm_suami':
      return 'ATM Suami';
    case 'cash_istri':
    case 'istri':
      return 'Cash Istri';
    case 'atm_istri':
      return 'ATM Istri';
    default:
      return h;
  }
}
