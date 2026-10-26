import React from 'react';

/**
 * Empty state component with icon, title, description, and optional action.
 * @param {object} props
 * @param {React.ComponentType} [props.icon] - Lucide icon component
 * @param {string} props.title - Empty state title
 * @param {string} props.description - Description text
 * @param {string} [props.actionLabel] - Action button label
 * @param {Function} [props.onAction] - Action button handler
 */
export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="mb-4 p-4 rounded-full bg-gray-100">
          <Icon className="w-10 h-10 text-gray-400" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 max-w-md mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 bg-linkedin text-white rounded-lg text-sm font-medium hover:bg-linkedin-dark transition-colors focus:outline-none focus:ring-2 focus:ring-linkedin focus:ring-offset-2"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
