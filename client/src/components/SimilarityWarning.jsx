import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

/**
 * Warning banner shown when a generated post is similar to existing content.
 * @param {object} props
 * @param {Array<{id: number, content: string, score: number}>} props.similarPosts - Similar posts data
 * @param {Function} [props.onRegenerate] - Regenerate callback
 */
export default function SimilarityWarning({ similarPosts, onRegenerate }) {
  const [expanded, setExpanded] = useState(false);

  if (!similarPosts || similarPosts.length === 0) return null;

  const highestScore = Math.max(...similarPosts.map((p) => p.score));
  const percentage = Math.round(highestScore * 100);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-800">
            Similar Content Detected ({percentage}% similarity)
          </h4>
          <p className="text-sm text-amber-700 mt-1">
            This post is similar to {similarPosts.length} previous post{similarPosts.length > 1 ? 's' : ''}.
            Consider regenerating to create more unique content.
          </p>

          {/* Expandable similar posts */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900 mt-2 transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Hide' : 'Show'} similar posts
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              {similarPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white border border-amber-200 rounded-md p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-amber-600 font-medium">
                      {Math.round(post.score * 100)}% similar
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-3 whitespace-pre-wrap">
                    {post.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Regenerate button */}
      {onRegenerate && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 rounded-md hover:bg-amber-200 transition-colors"
          >
            <RefreshCw size={12} />
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
