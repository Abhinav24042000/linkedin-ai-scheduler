import React from 'react';

/**
 * Status badge component for post/schedule statuses.
 * @param {object} props
 * @param {string} props.status - The status value
 */
export default function StatusBadge({ status }) {
  const config = {
    draft: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: 'Draft',
    },
    scheduled: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'Scheduled',
    },
    pending_approval: {
      bg: 'bg-amber-100',
      text: 'text-amber-700',
      label: 'Pending Approval',
    },
    publishing: {
      bg: 'bg-blue-100 animate-pulse-blue',
      text: 'text-blue-700',
      label: 'Publishing...',
    },
    published: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Published',
    },
    failed: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Failed',
    },
    paused: {
      bg: 'bg-gray-100',
      text: 'text-gray-500',
      label: 'Paused',
    },
    cancelled: {
      bg: 'bg-gray-100',
      text: 'text-gray-400 line-through',
      label: 'Cancelled',
    },
    active: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Active',
    },
  };

  const { bg, text, label } = config[status] || {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    label: status || 'Unknown',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}
