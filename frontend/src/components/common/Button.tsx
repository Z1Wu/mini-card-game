import React from 'react';
import { cn } from '../../utils/helpers';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className,
  loading = false,
  disabled: isDisabled,
  ...props
}) => {
  const baseStyles = 'font-semibold rounded-xl transition-all duration-200 shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0';
  
  const variantStyles = {
    primary: 'bg-[#ef7667] hover:bg-[#dc6255] text-white shadow-[#ef7667]/25',
    secondary: 'bg-[#e9dfcf] hover:bg-[#ded0bd] text-[#46516b]',
    accent: 'bg-[#55b9a7] hover:bg-[#439b8c] text-white',
    danger: 'bg-[#c95c60] hover:bg-[#b64c52] text-white',
  };
  
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      disabled={isDisabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
};
