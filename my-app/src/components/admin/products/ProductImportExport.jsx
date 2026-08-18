// src/components/admin/products/ProductImportExport.jsx
"use client";

import { useState, useRef, useEffect } from "react";
import productsApi from "@/lib/productsApi";
import categoriesApi from "@/lib/categoriesApi";
import brandsApi from "@/lib/brands/Api";
import { downloadCsv, toCsv, parseCsv } from "@/lib/csv";
import { Download, Upload, FileSpreadsheet, FileText, CheckCircle, X, Info } from "lucide-react";

// Only Name is truly required — everything else is optional so admins can
// fill in as much or as little as they have on hand and complete the rest later.
// Category/Subcategory/Brand are matched by NAME (not internal ID) since
// that's what a human filling a spreadsheet would actually know.
const TEMPLATE_COLUMNS = [
  { key: "Name", label: "Name *" },
  { key: "SKU", label: "SKU (leave blank to auto-generate)" },
  { key: "Model", label: "Model" },
  { key: "Category", label: "Category (by name)" },
  { key: "Subcategory", label: "Subcategory (by name)" },
  { key: "Brand", label: "Brand (by name)" },
  { key: "Description", label: "Description" },
  { key: "Key Features", label: "Key Features" },
  { key: "Material", label: "Material" },
  { key: "Manufacturer", label: "Manufacturer" },
  { key: "Applications", label: "Applications (semicolon-separated)" },
  { key: "Video URL", label: "Video URL" },
  { key: "Meta Title", label: "Meta Title" },
  { key: "Meta Description", label: "Meta Description" },
  { key: "Is Active", label: "Is Active (Yes/No, default Yes)" },
  { key: "Is Featured", label: "Is Featured (Yes/No, default No)" },
  { key: "Specifications", label: "Specifications (key: value; key2: value2)" },
  { key: "Certifications", label: "Certifications (semicolon-separated)" },
  { key: "Image URLs", label: "Image URLs (semicolon-separated)" },
];

// One filled-in example row so admins can see the expected format at a glance.
const TEMPLATE_EXAMPLE_ROW = {
  Name: "Industrial Safety Helmet",
  SKU: "",
  Model: "SH-200",
  Category: "Safety Equipment",
  Subcategory: "Head Protection",
  Brand: "SBS Pro",
  Description: "Impact-resistant ABS shell with adjustable ratchet suspension.",
  "Key Features": "Lightweight; ANSI Z89.1 rated; 4-point suspension",
  Material: "ABS Plastic",
  Manufacturer: "SBS Industries",
  Applications: "Construction; Manufacturing; Warehousing",
  "Video URL": "",
  "Meta Title": "",
  "Meta Description": "",
  "Is Active": "Yes",
  "Is Featured": "No",
  Specifications: "Weight: 350g; Color: Yellow; Standard: ANSI Z89.1",
  Certifications: "ISO 9001; CE Marked",
  "Image URLs": "",
};

const STORAGE_KEY = "sbs_admin_import_state";
const truthy = (v) => /^(y|yes|true|1)$/i.test(String(v || "").trim());

// "Construction; Manufacturing" -> ["Construction", "Manufacturing"]
const parseList = (v) =>
  String(v || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

// "Weight: 350g; Color: Yellow" -> { Weight: "350g", Color: "Yellow" }
// Matches the "key: value" format products.service.ts's exportToCSV writes.
const parseKeyValueList = (v) => {
  const out = {};
  for (const entry of parseList(v)) {
    const idx = entry.indexOf(":");
    if (idx === -1) continue;
    const key = entry.slice(0, idx).trim();
    const value = entry.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
};

export default function ProductImportExport({ products, setProducts }) {
  const fileInputRef = useRef(null);
  const [importStatus, setImportStatus] = useState(null);
  const [importPreview, setImportPreview] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    categoriesApi.getAll().then((c) => setCategories(Array.isArray(c) ? c : [])).catch(() => {});
    categoriesApi.getAllSubcategories().then((s) => setSubcategories(Array.isArray(s) ? s : [])).catch(() => {});
    brandsApi.getAll().then((b) => setBrands(Array.isArray(b) ? b : (b?.data || []))).catch(() => {});
  }, []);

  // Restore from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.importPreview) setImportPreview(parsed.importPreview);
        if (parsed.showPreview) setShowPreview(parsed.showPreview);
        if (parsed.fileName) setFileName(parsed.fileName);
        if (parsed.importStatus) setImportStatus(parsed.importStatus);
      } catch {}
    }
  }, []);

  useEffect(() => {
    const state = { importPreview, showPreview, fileName, importStatus };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [importPreview, showPreview, fileName, importStatus]);

  const handleExportCSV = async () => {
    try {
      // exportCSV() hits the filter-aware /products/export/csv endpoint;
      // this tab exports the full active catalog (it isn't tied to the
      // Products table's own filter panel, which lives on a separate tab).
      //
      // productsApi.exportCSV() only fetches the CSV blob — it doesn't
      // save it anywhere. Trigger the actual browser download here,
      // the same way handleDownloadTemplate does below.
      const blob = await productsApi.exportCSV();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert("Failed to export: " + error.message);
    }
  };

  const handleDownloadTemplate = () => {
    const csv = toCsv([TEMPLATE_EXAMPLE_ROW], TEMPLATE_COLUMNS.map((c) => ({ key: c.key, label: c.key })));
    downloadCsv("products-import-template.csv", csv);
  };

  const findIdByName = (list, name, nameKey = "name") => {
    if (!name?.trim()) return undefined;
    const match = list.find((x) => (x[nameKey] || "").trim().toLowerCase() === name.trim().toLowerCase());
    return match?.id;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      // Uses the shared RFC4180 parser (handles quoted commas/newlines) —
      // the old inline naive split(",") mangled any field with a comma in it.
      const parsed = parseCsv(event.target.result).filter((row) => row["Name"]?.trim());
      setImportPreview(parsed);
      setShowPreview(true);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmImport = async () => {
    setImporting(true);
    try {
      const productsToImport = importPreview.map((row) => {
        const categoryId = findIdByName(categories, row["Category"]);
        const subcategoryId = findIdByName(subcategories, row["Subcategory"]);
        const brandId = findIdByName(brands, row["Brand"], "name");
        const applicationNames = parseList(row["Applications"]);
        const imageUrls = parseList(row["Image URLs"]);
        return {
          name: row["Name"],
          sku: row["SKU"]?.trim() || undefined,
          model: row["Model"] || undefined,
          categoryId: categoryId || undefined,
          subcategoryId: subcategoryId || undefined,
          brandId: brandId || undefined,
          description: row["Description"] || undefined,
          keyFeatures: row["Key Features"] || undefined,
          material: row["Material"] || undefined,
          manufacturer: row["Manufacturer"] || undefined,
          videoUrl: row["Video URL"] || undefined,
          metaTitle: row["Meta Title"] || undefined,
          metaDescription: row["Meta Description"] || undefined,
          isActive: row["Is Active"] ? truthy(row["Is Active"]) : true,
          isFeatured: row["Is Featured"] ? truthy(row["Is Featured"]) : false,
          // Was previously a template column that was collected but never
          // actually sent — applications silently vanished on import.
          applications: applicationNames.length
            ? applicationNames.map((name) => ({ name }))
            : undefined,
          specifications: row["Specifications"]?.trim()
            ? parseKeyValueList(row["Specifications"])
            : undefined,
          certifications: parseList(row["Certifications"]).length
            ? parseList(row["Certifications"])
            : undefined,
          images: imageUrls.length
            ? imageUrls.map((url, i) => ({ url, sortOrder: i }))
            : undefined,
        };
      });
      const result = await productsApi.bulkImport(productsToImport);
      const errors = result?.errors || [];
      setImportStatus({
        type: errors.length ? "partial" : "success",
        message: `Imported ${result?.success ?? importPreview.length} of ${(result?.success ?? importPreview.length) + errors.length} product(s).`,
        errors,
      });
      setShowPreview(false);
      setImportPreview([]);
      setFileName("");
      sessionStorage.removeItem(STORAGE_KEY);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setImportStatus({ type: "error", message: "Import failed: " + error.message, errors: [] });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Import & Export</h2>
        <p className="mt-1 text-sm text-slate-500">Export the catalog, or bulk-import products from a filled-in CSV.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2"><Download size={20} className="text-blue-600" /><h3 className="text-lg font-semibold">Export</h3></div>
          <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-5 py-4 font-medium hover:bg-slate-50 w-full">
            <FileText size={20} className="text-green-600" /> Export CSV
          </button>
          <button onClick={handleDownloadTemplate} className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-5 py-4 font-medium hover:bg-slate-50 w-full">
            <FileSpreadsheet size={20} className="text-blue-600" /> Download Import Template
          </button>
          <p className="flex items-start gap-1.5 text-[11px] text-slate-400"><Info size={13} className="shrink-0 mt-0.5" /> Only <strong>Name</strong> is required — fill in whatever else you have and leave the rest blank.</p>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2"><Upload size={20} className="text-purple-600" /><h3 className="text-lg font-semibold">Import</h3></div>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-5 py-6 font-medium text-slate-500 hover:border-blue-400 w-full">
            <Upload size={20} /> Upload Filled Template
          </button>
          {fileName && <p className="text-xs text-slate-500 text-center">📄 {fileName}</p>}
          <p className="text-[11px] text-slate-400">Category/Subcategory/Brand are matched by name — make sure they match exactly what's set up under Categories.</p>
        </div>
      </div>

      {importStatus && (
        <div className={`rounded-2xl border p-4 space-y-2 ${importStatus.type === "success" ? "bg-green-50 border-green-200 text-green-700" : importStatus.type === "partial" ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-red-50 border-red-200 text-red-700"}`}>
          <div className="flex items-center gap-3"><CheckCircle size={20} /> {importStatus.message}</div>
          {importStatus.errors?.length > 0 && (
            <ul className="text-xs space-y-1 max-h-40 overflow-auto pl-7 list-disc">
              {importStatus.errors.slice(0, 20).map((e, i) => (
                <li key={i}>Row {e.row}{e.product ? ` (${e.product})` : ""}: {e.error || e.message}</li>
              ))}
              {importStatus.errors.length > 20 && <li>…and {importStatus.errors.length - 20} more</li>}
            </ul>
          )}
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-bold">Import Preview ({importPreview.length} products)</h3>
              <button onClick={() => { setShowPreview(false); setImportPreview([]); setFileName(""); sessionStorage.removeItem(STORAGE_KEY); }} className="rounded-lg p-2 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-6">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs">Name</th>
                    <th className="px-3 py-2 text-left text-xs">Model</th>
                    <th className="px-3 py-2 text-left text-xs">Category</th>
                    <th className="px-3 py-2 text-left text-xs">Brand</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((row, i) => {
                    const categoryFound = !row["Category"] || findIdByName(categories, row["Category"]);
                    return (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 text-xs">{row["Name"]}</td>
                        <td className="px-3 py-2 text-xs">{row["Model"] || "—"}</td>
                        <td className={`px-3 py-2 text-xs ${!categoryFound ? "text-amber-600 font-semibold" : ""}`}>
                          {row["Category"] || "—"}{!categoryFound ? " (not found — will import as Uncategorized)" : ""}
                        </td>
                        <td className="px-3 py-2 text-xs">{row["Brand"] || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <button onClick={() => { setShowPreview(false); setImportPreview([]); setFileName(""); sessionStorage.removeItem(STORAGE_KEY); }} className="rounded-xl border px-5 py-3 text-sm">Cancel</button>
              <button onClick={confirmImport} disabled={importing} className="rounded-xl bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                {importing ? "Importing..." : `Import ${importPreview.length} Products`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
