import React, { useState } from 'react';

/**
 * Shared Avatar component — shows profile picture if available, 
 * otherwise shows gradient initial.
 */
export function Avatar({ name, picture, size = 'md', className = '' }) {
  const [imgError, setImgError] = useState(false);

  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl',
  };

  const sizeClass = sizes[size] || sizes.md;
  const initial = name?.charAt(0)?.toUpperCase() || '?';

  if (picture && !imgError) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 ${className}`}>
        <img
          src={picture}
          alt={name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-white flex-shrink-0 shadow-md ${className}`}>
      {initial}
    </div>
  );
}
