/**
 * PRYORA Receipt Viewer Modal
 */

import React, { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { X, Download, FileText, Loader2 } from 'lucide-react';

interface ReceiptViewerModalProps {
  transactionId: string | null;
  merchantName: string;
  onClose: () => void;
}

export const ReceiptViewerModal: React.FC<ReceiptViewerModalProps> = ({
  transactionId,
  merchantName,
  onClose,
}) => {
  const [receipt, setReceipt] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!transactionId) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    apiRequest<{ receipt: any }>(`/api/transactions/${transactionId}/receipt`)
      .then(data => {
        if (mounted) {
          setReceipt(data.receipt);
          setLoading(false);
        }
      })
      .catch(err => {
        if (mounted) {
          setError(err.message || 'Could not load receipt.');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [transactionId]);

  if (!transactionId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800/80 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-800/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Receipt Attachment</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">{merchantName}</p>
          </div>
          <div className="flex items-center gap-2">
            {receipt?.data_base64 && (
              <a
                href={receipt.data_base64}
                download={receipt.file_name || `receipt_${transactionId}.jpg`}
                className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                title="Download Receipt"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-auto flex items-center justify-center min-h-[300px] bg-slate-900/5 dark:bg-slate-950/30">
          {loading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
              <span>Loading receipt...</span>
            </div>
          ) : error ? (
            <div className="text-center p-6 text-slate-500 dark:text-slate-400 text-xs">
              <FileText className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : receipt?.data_base64 ? (
            <img
              src={receipt.data_base64}
              alt="Receipt"
              className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500">No image available for this receipt.</p>
          )}
        </div>
      </div>
    </div>
  );
};
