// src/components/admin/products/RfqDetailModal.jsx
"use client";

import { X, Calendar, User, Building2, Mail, Phone, MapPin, MessageSquare, Package, Tag, Clock } from "lucide-react";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status) {
  const styles = {
    PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
    REPLIED: "bg-blue-100 text-blue-700 border-blue-200",
    PROCESSING: "bg-purple-100 text-purple-700 border-purple-200",
    COMPLETED: "bg-green-100 text-green-700 border-green-200",
    CANCELLED: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`rounded-full border px-3 py-0.5 text-xs font-bold uppercase ${styles[status] || ""}`}>
      {String(status || "").toLowerCase()}
    </span>
  );
}

export default function RfqDetailModal({ open, rfq, onClose }) {
  if (!open || !rfq) return null;

  const items = rfq.items || rfq.products || [];
  const client = rfq.client || {};

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 sticky top-0 bg-white rounded-t-3xl z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-900">RFQ Details</h3>
            <p className="text-sm text-slate-500">Reference: <span className="font-mono font-bold text-blue-700">{rfq.reference || rfq.id}</span></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Summary row */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 rounded-xl p-4 border">
            <div className="flex items-center gap-4">
              <Clock size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600">Received: {formatDate(rfq.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-600">Status:</span>
              {getStatusBadge(rfq.status)}
            </div>
          </div>

          {/* Client Information */}
          <div className="border rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <User size={18} className="text-blue-600" /> Client Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 font-medium">Full Name</p>
                <p className="font-semibold">{rfq.fullName || rfq.clientName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Company</p>
                <p className="font-semibold">{rfq.companyName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1"><Mail size={14} /> Email</p>
                <a href={`mailto:${rfq.email}`} className="text-blue-600 hover:underline">{rfq.email || "—"}</a>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium flex items-center gap-1"><Phone size={14} /> Mobile</p>
                <p>{rfq.mobile || "—"}</p>
              </div>
              {rfq.address && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 font-medium flex items-center gap-1"><MapPin size={14} /> Address</p>
                  <p className="whitespace-pre-line">{rfq.address}</p>
                </div>
              )}
              {rfq.remarks && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-slate-400 font-medium flex items-center gap-1"><MessageSquare size={14} /> Remarks</p>
                  <p className="whitespace-pre-line text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border">{rfq.remarks}</p>
                </div>
              )}
            </div>
          </div>

          {/* Products / Items */}
          <div className="border rounded-xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Package size={18} className="text-blue-600" /> Requested Products ({items.length})
            </h4>
            {items.length === 0 ? (
              <p className="text-sm text-slate-400">No products listed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">#</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Product</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-slate-500 uppercase">Model / SKU</th>
                      <th className="px-3 py-2 text-right text-xs font-bold text-slate-500 uppercase">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((item, idx) => {
                      const product = item.product || item;
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{product.name || "Unnamed product"}</td>
                          <td className="px-3 py-2 text-slate-500">{product.model || product.sku || "—"}</td>
                          <td className="px-3 py-2 text-right font-bold">{item.quantity || 1}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Optional: Reply history (if available) */}
          {rfq.responses && rfq.responses.length > 0 && (
            <div className="border rounded-xl p-5 space-y-3">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-600" /> Reply History
              </h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {rfq.responses.map((resp) => (
                  <div key={resp.id} className="bg-slate-50 rounded-lg p-3 border">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{resp.sentFrom || "Admin"}</span>
                      <span>{formatDate(resp.sentAt)}</span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{resp.emailBody || resp.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t px-6 py-4">
          <button onClick={onClose} className="rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-700">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}