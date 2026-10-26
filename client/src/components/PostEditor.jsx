import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Save, Send, Type, AlignLeft } from 'lucide-react';

/**
 * Rich post editor with character count, preview mode, and action buttons.
 * @param {object} props
 * @param {string} props.content - Post content
 * @param {Function} props.onChange - Content change handler
 * @param {Function} [props.onSave] - Save as draft handler
 * @param {Function} [props.onPublish] - Publish now handler
 * @param {number} [props.maxLength=3000] - Max character length (LinkedIn limit)
 * @param {boolean} [props.saving] - Whether save is in progress
 * @param {boolean} [props.publishing] - Whether publish is in progress
 */
export default function PostEditor({
  content,
  onChange,
  onSave,
  onPublish,
  maxLength = 3000,
  saving = false,
  publishing = false,
}) {
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef(null);

  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const isOverLimit = charCount > maxLength;
  const isNearLimit = charCount > maxLength * 0.9;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea && !preview) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(200, textarea.scrollHeight)}px`;
    }
  }, [content, preview]);

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreview(false)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              !preview
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <AlignLeft size={14} />
            Edit
          </button>
          <button
            onClick={() => setPreview(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              preview
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye size={14} />
            Preview
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{wordCount} words</span>
          <span
            className={`font-medium ${
              isOverLimit
                ? 'text-red-600'
                : isNearLimit
                ? 'text-amber-600'
                : 'text-gray-500'
            }`}
          >
            {charCount}/{maxLength}
          </span>
        </div>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div className="p-6 min-h-[200px]">
          {/* LinkedIn-style preview */}
          <div className="max-w-lg mx-auto bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gray-300 rounded-full" />
              <div>
                <div className="w-28 h-3 bg-gray-300 rounded mb-1" />
                <div className="w-20 h-2 bg-gray-200 rounded" />
              </div>
            </div>
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {content || (
                <span className="text-gray-400 italic">Your post preview will appear here...</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write your LinkedIn post here..."
          className="w-full p-4 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none min-h-[200px] leading-relaxed"
          style={{ maxHeight: '500px' }}
        />
      )}

      {/* Character limit warning bar */}
      {isOverLimit && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-100">
          <p className="text-xs text-red-600 font-medium">
            ⚠ Your post exceeds LinkedIn's {maxLength} character limit by {charCount - maxLength} characters.
          </p>
        </div>
      )}

      {/* Action buttons */}
      {(onSave || onPublish) && (
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
          {onSave && (
            <button
              onClick={onSave}
              disabled={!content.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save as Draft'}
            </button>
          )}
          {onPublish && (
            <button
              onClick={onPublish}
              disabled={!content.trim() || isOverLimit || publishing}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-linkedin rounded-lg hover:bg-linkedin-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={14} />
              {publishing ? 'Publishing...' : 'Publish Now'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
