// src/app/(admin)/admin/products/page.js
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Package, FolderTree, MessageSquare, Settings, BarChart3, Download, RefreshCw, Plus, Grid3X3, List, MoreVertical, ChevronDown, Layers } from "lucide-react";
import ProductsTable from "@/components/admin/products/ProductsTable";
import ProductFormModal from "@/components/admin/products/ProductFormModal";
// import ProductCardDesigner from "@/components/admin/products/ProductCardDesigner";
// import ProductDetailDesigner from "@/components/admin/products/ProductDetailDesigner";
// import ProductSettings from "@/components/admin/products/ProductSettings";
// import ProductNotifications from "@/components/admin/products/ProductNotifications";
import ProductImportExport from "@/components/admin/products/ProductImportExport";
// import ProductPreview from "@/components/admin/products/ProductPreview";
import CategoriesManager from "@/components/admin/products/CategoriesManager";
import VariantsBrowser from "@/components/admin/products/VariantsBrowser";
import RfqManager from "@/components/admin/products/RfqManager";
// import RfqSettings from "@/components/admin/products/RfqSettings";
import RfqIntegrationSettings from "@/components/admin/products/RfqIntegrationSettings";
import productsApi from "@/lib/productsApi";
import categoriesApi from "@/lib/categoriesApi";
import brandsApi from "@/lib/brands/Api";

// STORAGE KEYS
const STORAGE_KEY_TAB = "sbs_admin_products_tab";
const STORAGE_KEY_FORM = "sbs_admin_product_form_state";

const tabs = [
  { id: "products", label: "Products", icon: Package },
  { id: "categories", label: "Categories & Subcategories", icon: FolderTree },
  { id: "variants", label: "Variants", icon: Layers },
  { id: "importexport", label: "Import / Export", icon: Download },
  { id: "rfq", label: "RFQ Manager", icon: MessageSquare },
  { id: "rfqintegrations", label: "RFQ Integrations", icon: Settings },
];
// Secondary views reached via the ⋮ menu next to the products table — only
// "Products" itself renders as the default/home view.
const moreViews = tabs.filter((t) => t.id !== "products");

import { Suspense } from "react";

function ProductsAdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // --- Tab state with persistence ---
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(STORAGE_KEY_TAB);
      if (saved && tabs.some((t) => t.id === saved)) return saved;
    }
    return "products";
  });
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY_TAB, activeTab);
  }, [activeTab]);

  // --- Data states ---
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [pagination, setPagination] = useState({
    total: 0, page: 1, pageSize: 20, totalPages: 1,
    hasNextPage: false, hasPreviousPage: false
  });

  // Deep link from admin search: /admin/products?edit=<id> opens that
  // product's edit modal directly, fetching it by id rather than relying on
  // whatever page of the (paginated) product list happens to be loaded.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    productsApi
      .getById(editId)
      .then((product) => {
        if (product) {
          setEditingProduct(product);
          setShowProductModal(true);
          setActiveTab("products");
        }
      })
      .catch((err) => console.error("Failed to load product for edit link:", err))
      .finally(() => {
        // Strip the query param so it doesn't re-trigger / linger in the URL.
        router.replace("/admin/products");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // --- Restore form state from sessionStorage ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem(STORAGE_KEY_FORM);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.editingProduct) {
          setEditingProduct(parsed.editingProduct);
          setShowProductModal(true);
        }
      } catch (e) {
        sessionStorage.removeItem(STORAGE_KEY_FORM);
      }
    }
  }, []);

  // --- Save form state when modal opens/closes ---
  const saveFormState = (editing, modalOpen) => {
    if (typeof window === "undefined") return;
    if (modalOpen && editing) {
      sessionStorage.setItem(STORAGE_KEY_FORM, JSON.stringify({ editingProduct: editing }));
    } else {
      sessionStorage.removeItem(STORAGE_KEY_FORM);
    }
  };

  useEffect(() => {
    saveFormState(editingProduct, showProductModal);
  }, [editingProduct, showProductModal]);

  // --- Data fetching ---
  const extractData = (response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (response.data && Array.isArray(response.data)) return response.data;
    return [];
  };

  const fetchProducts = async (page = 1, pageSize = 20) => {
    try {
      const response = await productsApi.getAll({ page, pageSize, search: searchQuery || undefined });
      setProducts(extractData(response));
      if (response?.meta) setPagination(response.meta);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      setProducts([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll();
      setCategories(extractData(response));
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      setCategories([]);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const response = await categoriesApi.getAllSubcategories();
      setSubcategories(extractData(response));
    } catch (error) {
      console.error("Failed to fetch subcategories:", error);
      setSubcategories([]);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await brandsApi.getAll();
      setBrands(extractData(response));
    } catch (error) {
      console.error("Failed to fetch brands:", error);
      setBrands([]);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProducts(pagination.page, pagination.pageSize),
      fetchCategories(),
      fetchSubcategories(),
      fetchBrands(),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    if (searchQuery !== undefined) {
      fetchProducts(1, pagination.pageSize);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (autoRefresh > 0) {
      const interval = setInterval(() => {
        fetchProducts(pagination.page, pagination.pageSize);
        setLastRefresh(new Date());
      }, autoRefresh * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, pagination.page, pagination.pageSize]);

  // --- Modal handlers ---
  const handleCreateProduct = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  const handleEditProduct = (product) => {
    setEditingProduct(product);
    setShowProductModal(true);
  };

  const handleSaveProduct = async (productData, pendingBrochure, pendingDesignFile) => {
    try {
      if (editingProduct) {
        await productsApi.update(editingProduct.id, productData);
      } else {
        const created = await productsApi.create(productData);
        if (pendingBrochure && created?.id) {
          try {
            await productsApi.uploadBrochure(created.id, pendingBrochure);
          } catch (e) {
            alert("Product created, but brochure upload failed: " + e.message);
          }
        }
        if (pendingDesignFile && created?.id) {
          try {
            await productsApi.uploadDesignFile(created.id, pendingDesignFile);
          } catch (e) {
            alert("Product created, but design file upload failed: " + e.message);
          }
        }
      }
      setShowProductModal(false);
      setEditingProduct(null);
      sessionStorage.removeItem(STORAGE_KEY_FORM);
      await fetchProducts(pagination.page, pagination.pageSize);
    } catch (error) {
      console.error("Failed to save product:", error);
      alert("Failed to save product: " + error.message);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm("Delete this product permanently?")) return;
    try {
      await productsApi.delete(productId);
      await fetchProducts(pagination.page, pagination.pageSize);
    } catch (error) {
      console.error("Failed to delete product:", error);
      alert("Failed to delete product: " + error.message);
    }
  };

  const handleBulkDeleteProducts = async (productIds) => {
    if (!productIds?.length) return;
    if (!confirm(`Delete ${productIds.length} selected product${productIds.length > 1 ? "s" : ""} permanently?`)) return;
    try {
      for (const id of productIds) {
        await productsApi.delete(id);
      }
      await fetchProducts(pagination.page, pagination.pageSize);
    } catch (error) {
      console.error("Failed to bulk delete products:", error);
      alert("Some products may not have been deleted: " + error.message);
    }
  };

  const handleDuplicateProduct = async (product) => {
    try {
      const newProduct = {
        name: `${product.name} (Copy)`,
        model: product.model,
        description: product.description,
        keyFeatures: product.keyFeatures,
        material: product.material,
        manufacturer: product.manufacturer,
        categoryId: product.categoryId,
        subcategoryId: product.subcategoryId,
        brandId: product.brandId,
        isActive: true,
        isFeatured: false,
        images: (product.images || []).map(img => ({
          url: img.url,
          title: img.title || '',
          angle: img.angle || '',
          altText: img.altText || '',
        })),
        specifications: (product.specifications || []).reduce((acc, spec) => {
          acc[spec.key] = spec.value;
          return acc;
        }, {}),
        certifications: (product.certifications || []).map(c => c.name || c),
      };
      await productsApi.create(newProduct);
      await fetchProducts(pagination.page, pagination.pageSize);
    } catch (error) {
      console.error("Failed to duplicate product:", error);
      alert("Failed to duplicate product: " + error.message);
    }
  };

  const handlePageChange = (page, pageSize) => {
    fetchProducts(page, pageSize);
  };

  const renderContent = () => {
    if (loading && activeTab === "products") {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      );
    }

    switch (activeTab) {
      case "products":
        return (
          <ProductsTable
            products={products}
            categories={categories}
            subcategories={subcategories}
            brands={brands}
            onEdit={handleEditProduct}
            onDelete={handleDeleteProduct}
            onBulkDelete={handleBulkDeleteProducts}
            onDuplicate={handleDuplicateProduct}
            onCreate={handleCreateProduct}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            pagination={pagination}
            onPageChange={handlePageChange}
          />
        );
      case "categories":
        return <CategoriesManager />;
      case "variants":
        return <VariantsBrowser onEditProduct={handleEditProduct} />;
      case "importexport": return <ProductImportExport products={products} setProducts={setProducts} />;
      case "rfq": return <RfqManager />;
      case "rfqintegrations": return <RfqIntegrationSettings />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Products Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            {pagination.total} products · {categories.length} categories · {brands.length} brands
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {[
          { label: "Total Products", value: pagination.total, color: "text-blue-600", bg: "bg-blue-50", icon: Package },
          { label: "Categories", value: categories.length, color: "text-green-600", bg: "bg-green-50", icon: FolderTree },
          { label: "Subcategories", value: subcategories.length, color: "text-purple-600", bg: "bg-purple-50", icon: FolderTree },
          { label: "Brands", value: brands.length, color: "text-orange-600", bg: "bg-orange-50", icon: Package },
          { label: "Active RFQs", value: "—", color: "text-red-600", bg: "bg-red-50", icon: MessageSquare },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border bg-white p-3 md:p-4 shadow-sm flex items-center gap-2 md:gap-3 hover:shadow-md transition-shadow">
              <div className={`flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg md:rounded-xl shrink-0 ${stat.bg}`}>
                <Icon size={16} className={`md:size-[18px] ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{stat.label}</p>
                <h3 className={`text-lg md:text-xl font-bold ${stat.color}`}>{stat.value}</h3>
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
          <div className="flex items-center gap-2">
            {(() => {
              const current = tabs.find((t) => t.id === activeTab) || tabs[0];
              const Icon = current.icon;
              return (
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                  <Icon size={16} className="text-blue-600" /> {current.label}
                </span>
              );
            })()}
            {activeTab !== "products" && (
              <button onClick={() => setActiveTab("products")}
                className="ml-2 text-xs font-semibold text-blue-600 hover:underline">
                ← Back to Products
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === "products" && (
              <button onClick={handleCreateProduct} title="Add new product"
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
                <Plus size={17} />
              </button>
            )}
            <div className="relative">
              <button onClick={() => setShowMoreMenu((v) => !v)} title="More views"
                className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100">
                <MoreVertical size={16} />
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-20 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
                    {moreViews.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => { setActiveTab(tab.id); setShowMoreMenu(false); }}
                          className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-left transition-colors ${
                            activeTab === tab.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <Icon size={15} /> {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="p-6">{renderContent()}</div>
      </div>

      {showProductModal && (
        <ProductFormModal
          open={showProductModal}
          initialData={editingProduct}
          categories={categories}
          subcategories={subcategories}
          brands={brands}
          onClose={() => { 
            setShowProductModal(false); 
            setEditingProduct(null);
            sessionStorage.removeItem(STORAGE_KEY_FORM);
          }}
          onSave={handleSaveProduct}
        />
      )}
    </div>
  );
}

export default function ProductsAdminPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    }>
      <ProductsAdminContent />
    </Suspense>
  );
}