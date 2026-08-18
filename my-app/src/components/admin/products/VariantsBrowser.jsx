"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Edit, Trash2, Package, ImageOff } from "lucide-react";
import toast from "react-hot-toast";
import productsApi from "@/lib/productsApi";
import { toStaticUrl } from "@/lib/client";

function VariantRow({ variant, productId, onEdit, onDeleted }) {
  const thumb = variant.images?.[0];
  const attrSummary = Object.entries(variant.attributes || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete variant "${variant.name}"?`)) return;
    try {
      await productsApi.deleteVariant(productId, variant.id);
      toast.success("Variant deleted");
      onDeleted(variant.id);
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t hover:bg-slate-50">
      {thumb ? (
        <img src={toStaticUrl(thumb)} alt="" className="w-9 h-9 rounded-lg object-cover border shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-slate-100 border flex items-center justify-center text-slate-300 shrink-0">
          <ImageOff size={14} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-800 truncate">{variant.name}</p>
        <p className="text-[10px] text-slate-400 truncate">{attrSummary || "No attributes set"}</p>
      </div>
      {variant.model && (
        <span className="hidden sm:inline text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded shrink-0">
          {variant.model}
        </span>
      )}
      {variant.brand?.name && (
        <span className="hidden md:inline text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded shrink-0">
          {variant.brand.name}
        </span>
      )}
      <span className={`text-[10px] font-bold px-2 py-1 rounded shrink-0 ${variant.isActive !== false ? "text-emerald-700 bg-emerald-50" : "text-slate-400 bg-slate-100"}`}>
        {variant.isActive !== false ? "Active" : "Inactive"}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} title="Edit in product form" className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600">
          <Edit size={13} />
        </button>
        <button onClick={handleDelete} title="Delete variant" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function ProductVariantGroup({ product, onEditProduct }) {
  const [expanded, setExpanded] = useState(true);
  const [variants, setVariants] = useState(product.variants || []);

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
        {expanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
        {product.images?.[0]?.url ? (
          <img src={toStaticUrl(product.images[0].url)} alt="" className="w-8 h-8 rounded-lg object-cover border shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-100 border flex items-center justify-center text-slate-300 shrink-0"><Package size={14} /></div>
        )}
        <span className="text-sm font-bold text-slate-800 truncate flex-1 text-left">{product.name}</span>
        <span className="text-[10px] font-black uppercase text-slate-400 shrink-0">{variants.length} variant{variants.length === 1 ? "" : "s"}</span>
        <span onClick={(e) => { e.stopPropagation(); onEditProduct(product); }}
          className="text-[10px] font-bold text-blue-600 hover:underline shrink-0 cursor-pointer">
          Open product →
        </span>
      </button>
      {expanded && (
        <div>
          {variants.map((v) => (
            <VariantRow key={v.id} variant={v} productId={product.id} onEdit={() => onEditProduct(product)}
              onDeleted={(id) => setVariants((vs) => vs.filter((x) => x.id !== id))} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function VariantsBrowser({ onEditProduct }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    productsApi.getAll({ pageSize: 100 })
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.data || [];
        setProducts(list.filter((p) => p.variants?.length > 0));
      })
      .catch(() => toast.error("Failed to load variants"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter((p) =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Product Variants</h2>
        <p className="text-xs text-slate-500 mt-0.5">Every product that has variants set up, browsable in one place. Showing the first 100 products with variants.</p>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by product name…"
        className="w-full max-w-sm text-sm border rounded-xl px-3.5 py-2.5"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-400 font-medium">
          {products.length === 0 ? "No products have variants set up yet." : "No products match your search."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <ProductVariantGroup key={product.id} product={product} onEditProduct={onEditProduct} />
          ))}
        </div>
      )}
    </div>
  );
}
