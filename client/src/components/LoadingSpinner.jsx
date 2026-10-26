import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Loading spinner component with optional text.
 * @param {object} props
 * @param {'sm'|'md'|'lg'} props.size - Spinner size
 * @param {string} [props.text] - Optional loading text
 */
export default function LoadingSpinner({ size = 'md', text }) {
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 className={`${sizeClasses[size]} animate-spin text-linkedin`} />
      {text && (
        <p className={`${textSizeClasses[size]} text-gray-500 font-medium`}>{text}</p>
      )}
    </div>
  );
}
