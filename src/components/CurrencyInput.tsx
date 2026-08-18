'use client';

import React, { useEffect, useState } from 'react';
import { formatNumberWithSeparators, parseFormattedNumber } from '@/lib/utils';

interface CurrencyInputProps {
  value: number | string;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0',
  className = '',
  required = false,
  disabled = false,
  autoFocus = false,
  id,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    return value ? formatNumberWithSeparators(value) : '';
  });

  useEffect(() => {
    setDisplayValue(value ? formatNumberWithSeparators(value) : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const num = parseFormattedNumber(rawVal);
    const formatted = num > 0 ? formatNumberWithSeparators(num) : '';

    setDisplayValue(formatted);
    onChange(num);
  };

  return (
    <div className="relative w-full">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold select-none text-sm">
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`w-full bg-surface border border-foreground/10 dark:border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-xl font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-text-muted/40 ${className}`}
      />
    </div>
  );
}
