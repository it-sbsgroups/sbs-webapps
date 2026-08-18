"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ✅ LIVE DATA — fetched from the NestJS backend (no more static dummy data)
import publicCatalogApi from "@/lib/publicCatalogApi";
import PageBreadcrumb from "@/components/shared/PageBreadcrumb";
import apiClient from "@/lib/client";
import rfqApi from "@/lib/rfqApi";
import headerApi from "@/lib/headerApi";
import LazyCacheImage from "@/components/shared/LazyCacheImage";
import { useRfqCart } from "@/context/RfqCartContext";
import VariantPickerModal from "@/components/shared/VariantPickerModal";

// ✅ PDF GENERATION — @react-pdf/renderer imports (single file merge)
import { pdf, Document, Page, Text, View, Image, StyleSheet, Link as PdfLink } from "@react-pdf/renderer";

// ✅ SETTINGS — admin-controlled look & behavior (read-only here)
import {
  loadProductsSettings,
  GAP_CLASS,
  COLS_CLASS,
  RATIO_CLASS,
  CARD_STYLE_CLASS,
  IMAGE_FIT_CLASS,
} from "@/lib/productsSettings";

// First usable image url for a product, with a safe fallback.
const getProductImage = (product) => {
  const img = Array.isArray(product.images)
    ? product.images.find((i) => i?.url)
    : null;
  return img?.url || "";
};

// ============================================================================
// CATALOGUE PDF GENERATION
// ----------------------------------------------------------------------------
// Product photos are uploaded and stored as WebP on Cloudinary (see
// ProductImageUploader), but @react-pdf/renderer's <Image> component can only
// embed JPEG/PNG — that mismatch is why the catalogue PDF used to generate
// with no product images at all. To fix it for good (regardless of source
// format or CORS quirks), every image is loaded into an offscreen <canvas>
// first and re-encoded as a JPEG data URI before being handed to react-pdf.
// ============================================================================

// description/keyFeatures come from the rich-text editor as HTML — react-pdf's
// <Text> can't render HTML, so this converts it to clean plain text first
// (preserving paragraph/list-item breaks) instead of dumping raw tags.
const htmlToPlainText = (html) => {
  if (!html) return "";
  return String(html)
    .replace(/<li[^>]*>/gi, "•  ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const truncateText = (text, max) => {
  if (!text) return "";
  const clean = htmlToPlainText(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
};

function loadImageAsDataUri(url, { maxDim = 900, timeoutMs = 15000 } = {}) {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    // NOTE: `window.Image` (the browser constructor) — not react-pdf's
    // <Image> component, which is imported under the same name above.
    const img = new window.Image();
    img.crossOrigin = "anonymous"; // needed to re-encode a cross-origin (Cloudinary) image via canvas
    img.onload = () => {
      clearTimeout(timer);
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (!w || !h) return finish(null);
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        finish(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        // A cross-origin image with no CORS headers taints the canvas —
        // fall back to "no image" for that one product instead of failing
        // the whole catalogue.
        finish(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish(null);
    };
    img.src = url;
  });
}

// Loads every product's image (bounded concurrency) and reports progress so
// the download button can show real feedback instead of a frozen spinner.
async function preloadCatalogueImages(products, onProgress) {
  const map = {};
  let done = 0;
  const total = products.length;
  const queue = [...products];
  const CONCURRENCY = 6;

  const worker = async () => {
    while (queue.length) {
      const product = queue.shift();
      map[product.id] = await loadImageAsDataUri(product.imageUrl);
      done += 1;
      onProgress?.(done, total);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total || 1) }, worker));
  return map;
}

// Four distinct visual layouts so consecutive product pages never look like
// carbon copies of each other. Shuffled once per generation run, then cycled
// through — that way no two neighbouring pages repeat the same design.
const CATALOG_THEMES = [
  { id: "left", accent: "#1e3a8a", soft: "#eef2ff", layout: "left" },
  { id: "top", accent: "#3f6212", soft: "#f4f8e8", layout: "top" },
  { id: "right", accent: "#0f172a", soft: "#f1f5f9", layout: "right" },
  { id: "banner", accent: "#0e7490", soft: "#ecfeff", layout: "banner" },
];

function shuffledThemeCycle(count) {
  const shuffled = [...CATALOG_THEMES].sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, i) => shuffled[i % shuffled.length]);
}

const catalogStyles = StyleSheet.create({
  page: { padding: 0, backgroundColor: "#ffffff", fontFamily: "Helvetica" },
  coverPage: { padding: 0, backgroundColor: "#ffffff", fontFamily: "Helvetica" },

  topBar: { height: 8, width: "100%" },
  content: { flex: 1, padding: 36, paddingBottom: 44, display: "flex", flexDirection: "column" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 36,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  footerText: { fontSize: 8, color: "#94a3b8" },

  tag: {
    alignSelf: "flex-start",
    fontSize: 8,
    color: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 3,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pillOutline: {
    fontSize: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },

  productName: { fontSize: 19, fontFamily: "Helvetica-Bold", color: "#0f172a" },
  metaRow: { flexDirection: "row", marginTop: 4, marginBottom: 10 },
  metaText: { fontSize: 9, color: "#64748b", marginRight: 14 },

  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "#94a3b8",
    marginBottom: 6,
    marginTop: 14,
  },
  bodyText: { fontSize: 9.5, color: "#334155", lineHeight: 1.5 },

  exploreLink: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 12,
    alignSelf: "flex-start",
    textDecoration: "none",
  },

  specRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 4,
  },
  specKey: {
    width: "40%",
    fontSize: 8.5,
    color: "#94a3b8",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  specValue: { width: "60%", fontSize: 9, color: "#1e293b" },

  specCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    marginRight: "4%",
  },
  specCardLabel: {
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#94a3b8",
    marginBottom: 3,
  },
  specCardValue: { fontSize: 9.5, color: "#0f172a", fontFamily: "Helvetica-Bold" },

  imageFrame: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  placeholderText: { fontSize: 8, color: "#cbd5e1", marginTop: 4 },
});

function CatalogFooter({ accent, index, total, product }) {
  return (
    <View style={catalogStyles.footer} fixed>
      <Text style={catalogStyles.footerText}>{product?.id ? `SKU ${product.id}` : "Product Catalogue"}</Text>
      <Text style={[catalogStyles.footerText, { color: accent }]}>
        {index} / {total}
      </Text>
    </View>
  );
}

function SpecsTable({ specs, max = 8 }) {
  if (!specs?.length) return null;
  return (
    <View>
      {specs.slice(0, max).map((s, i) => (
        <View key={i} style={catalogStyles.specRow}>
          <Text style={catalogStyles.specKey}>{s.key}</Text>
          <Text style={catalogStyles.specValue}>{s.value}</Text>
        </View>
      ))}
    </View>
  );
}

function SpecsGrid({ specs, max = 6 }) {
  if (!specs?.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {specs.slice(0, max).map((s, i) => (
        <View key={i} style={catalogStyles.specCard}>
          <Text style={catalogStyles.specCardLabel}>{s.key}</Text>
          <Text style={catalogStyles.specCardValue}>{s.value}</Text>
        </View>
      ))}
    </View>
  );
}

function CertPills({ certs, accent }) {
  if (!certs?.length) return null;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
      {certs.slice(0, 8).map((c, i) => (
        <Text key={i} style={[catalogStyles.pillOutline, { borderColor: accent, color: accent }]}>
          {typeof c === "string" ? c : c.name}
        </Text>
      ))}
    </View>
  );
}

// Deep-links back to the live product page on the website — every layout
// below renders this near the bottom of the product's spread.
function ExploreDetailsLink({ sku, theme }) {
  const siteUrl = (typeof window !== "undefined" && window.location.origin) || "https://sbsgroups.co.in";
  return (
    <PdfLink src={`${siteUrl}/products/${sku}`} style={[catalogStyles.exploreLink, { borderColor: theme.accent, color: theme.accent }]}>
      Wants to explore with full details?  Visit sbsgroups.co.in/products/{sku} →
    </PdfLink>
  );
}

function ProductImageBox({ dataUri, style }) {
  return (
    <View style={[catalogStyles.imageFrame, style]}>
      {dataUri ? (
        <Image src={dataUri} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      ) : (
        <View style={catalogStyles.imagePlaceholder}>
          <Text style={{ fontSize: 22, color: "#e2e8f0" }}>—</Text>
          <Text style={catalogStyles.placeholderText}>No image available</Text>
        </View>
      )}
    </View>
  );
}

// --- Layout 1: image left, details right — the "classic" catalogue spread.
function ProductPageLeft({ product, dataUri, theme, index, total }) {
  return (
    <Page size="A4" style={catalogStyles.page}>
      <View style={[catalogStyles.topBar, { backgroundColor: theme.accent }]} />
      <View style={catalogStyles.content}>
        <Text style={[catalogStyles.tag, { backgroundColor: theme.accent }]}>{product.categoryLabel}</Text>

        <View style={{ flexDirection: "row", marginTop: 16 }}>
          <View style={{ width: "40%", marginRight: 20 }}>
            <ProductImageBox dataUri={dataUri} style={{ height: 200, backgroundColor: theme.soft }} />
            {product.brandName ? (
              <Text style={{ fontSize: 9, color: "#64748b", marginTop: 8, textAlign: "center" }}>
                {product.brandName}
              </Text>
            ) : null}
          </View>

          <View style={{ width: "60%" }}>
            <Text style={catalogStyles.productName}>{product.name}</Text>
            <View style={catalogStyles.metaRow}>
              {product.model ? <Text style={catalogStyles.metaText}>Model: {product.model}</Text> : null}
              <Text style={catalogStyles.metaText}>SKU: {product.id}</Text>
            </View>

            {product.description ? (
              <>
                <Text style={catalogStyles.sectionLabel}>Overview</Text>
                <Text style={catalogStyles.bodyText}>{truncateText(product.description, 420)}</Text>
              </>
            ) : null}

            {product.keyFeatures ? (
              <>
                <Text style={catalogStyles.sectionLabel}>Key Features</Text>
                <Text style={catalogStyles.bodyText}>{truncateText(product.keyFeatures, 260)}</Text>
              </>
            ) : null}

            <ExploreDetailsLink sku={product.id} theme={theme} />
          </View>
        </View>

        {product.specifications?.length ? (
          <>
            <Text style={catalogStyles.sectionLabel}>Specifications</Text>
            <SpecsTable specs={product.specifications} />
          </>
        ) : null}

        <CertPills certs={product.certifications} accent={theme.accent} />
      </View>
      <CatalogFooter accent={theme.accent} index={index} total={total} product={product} />
    </Page>
  );
}

// --- Layout 2: full-width hero image on top, two-column details below.
function ProductPageTop({ product, dataUri, theme, index, total }) {
  return (
    <Page size="A4" style={catalogStyles.page}>
      <View style={{ height: 210, backgroundColor: theme.soft, position: "relative" }}>
        <ProductImageBox dataUri={dataUri} style={{ height: "100%", borderWidth: 0, borderRadius: 0 }} />
        <Text
          style={[
            catalogStyles.tag,
            { position: "absolute", top: 14, left: 36, backgroundColor: theme.accent },
          ]}
        >
          {product.categoryLabel}
        </Text>
      </View>

      <View style={catalogStyles.content}>
        <Text style={catalogStyles.productName}>{product.name}</Text>
        <View style={catalogStyles.metaRow}>
          {product.brandName ? <Text style={catalogStyles.metaText}>{product.brandName}</Text> : null}
          {product.model ? <Text style={catalogStyles.metaText}>Model: {product.model}</Text> : null}
          <Text style={catalogStyles.metaText}>SKU: {product.id}</Text>
        </View>

        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <View style={{ width: "58%", paddingRight: 16 }}>
            {product.description ? (
              <>
                <Text style={catalogStyles.sectionLabel}>Overview</Text>
                <Text style={catalogStyles.bodyText}>{truncateText(product.description, 500)}</Text>
              </>
            ) : null}
            <CertPills certs={product.certifications} accent={theme.accent} />
          </View>
          <View style={{ width: "42%" }}>
            {product.keyFeatures ? (
              <View style={{ backgroundColor: theme.soft, borderRadius: 6, padding: 10, marginBottom: 10 }}>
                <Text style={[catalogStyles.sectionLabel, { marginTop: 0, color: theme.accent }]}>
                  Key Features
                </Text>
                <Text style={catalogStyles.bodyText}>{truncateText(product.keyFeatures, 260)}</Text>
              </View>
            ) : null}
            {product.specifications?.length ? <SpecsTable specs={product.specifications} max={6} /> : null}
          </View>
        </View>

        <ExploreDetailsLink sku={product.id} theme={theme} />
      </View>
      <CatalogFooter accent={theme.accent} index={index} total={total} product={product} />
    </Page>
  );
}

// --- Layout 3: details left, image right (mirrored classic spread).
function ProductPageRight({ product, dataUri, theme, index, total }) {
  return (
    <Page size="A4" style={catalogStyles.page}>
      <View style={[catalogStyles.topBar, { backgroundColor: theme.accent }]} />
      <View style={catalogStyles.content}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ width: "56%" }}>
            <Text style={[catalogStyles.tag, { backgroundColor: theme.accent, marginBottom: 8 }]}>
              {product.categoryLabel}
            </Text>
            <Text style={catalogStyles.productName}>{product.name}</Text>
            <View style={catalogStyles.metaRow}>
              {product.model ? <Text style={catalogStyles.metaText}>Model: {product.model}</Text> : null}
              <Text style={catalogStyles.metaText}>SKU: {product.id}</Text>
            </View>
            {product.description ? (
              <Text style={catalogStyles.bodyText}>{truncateText(product.description, 380)}</Text>
            ) : null}
          </View>
          <ProductImageBox
            dataUri={dataUri}
            style={{ width: "40%", height: 170, backgroundColor: theme.soft }}
          />
        </View>

        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <View style={{ width: "60%" }}>
            {product.specifications?.length ? (
              <>
                <Text style={catalogStyles.sectionLabel}>Specifications</Text>
                <SpecsTable specs={product.specifications} />
              </>
            ) : null}
          </View>
          <View style={{ width: "40%", paddingLeft: 16 }}>
            {product.keyFeatures ? (
              <>
                <Text style={catalogStyles.sectionLabel}>Key Features</Text>
                <Text style={catalogStyles.bodyText}>{truncateText(product.keyFeatures, 220)}</Text>
              </>
            ) : null}
            <CertPills certs={product.certifications} accent={theme.accent} />
          </View>
        </View>

        <ExploreDetailsLink sku={product.id} theme={theme} />
      </View>
      <CatalogFooter accent={theme.accent} index={index} total={total} product={product} />
    </Page>
  );
}

// --- Layout 4: bold colour banner header, centered image, spec-card grid.
function ProductPageBanner({ product, dataUri, theme, index, total }) {
  return (
    <Page size="A4" style={catalogStyles.page}>
      <View style={{ backgroundColor: theme.accent, paddingVertical: 16, paddingHorizontal: 36 }}>
        <Text style={{ fontSize: 8, color: "#ffffff", opacity: 0.8, textTransform: "uppercase", letterSpacing: 1 }}>
          {product.categoryLabel}
        </Text>
        <Text style={{ fontSize: 19, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 2 }}>
          {product.name}
        </Text>
        <View style={{ flexDirection: "row", marginTop: 4 }}>
          {product.brandName ? (
            <Text style={{ fontSize: 9, color: "#ffffff", opacity: 0.85, marginRight: 14 }}>
              {product.brandName}
            </Text>
          ) : null}
          {product.model ? (
            <Text style={{ fontSize: 9, color: "#ffffff", opacity: 0.85, marginRight: 14 }}>
              Model: {product.model}
            </Text>
          ) : null}
          <Text style={{ fontSize: 9, color: "#ffffff", opacity: 0.85 }}>SKU: {product.id}</Text>
        </View>
      </View>

      <View style={catalogStyles.content}>
        <View style={{ alignItems: "center", marginBottom: 12 }}>
          <ProductImageBox dataUri={dataUri} style={{ width: 220, height: 170, backgroundColor: theme.soft }} />
        </View>

        {product.description ? (
          <Text style={[catalogStyles.bodyText, { textAlign: "center", marginBottom: 10 }]}>
            {truncateText(product.description, 300)}
          </Text>
        ) : null}

        {product.specifications?.length ? (
          <>
            <Text style={[catalogStyles.sectionLabel, { textAlign: "center" }]}>Specifications</Text>
            <SpecsGrid specs={product.specifications} />
          </>
        ) : null}

        <View style={{ alignItems: "center" }}>
          <CertPills certs={product.certifications} accent={theme.accent} />
        </View>

        <View style={{ alignItems: "center" }}>
          <ExploreDetailsLink sku={product.id} theme={theme} />
        </View>
      </View>
      <CatalogFooter accent={theme.accent} index={index} total={total} product={product} />
    </Page>
  );
}

const CATALOG_LAYOUT_COMPONENTS = {
  left: ProductPageLeft,
  top: ProductPageTop,
  right: ProductPageRight,
  banner: ProductPageBanner,
};

// --- Cover page: company branding (best-effort) + catalogue overview.
function CoverPage({ branding, totalProducts, categoryNames, generatedOn }) {
  return (
    <Page size="A4" style={catalogStyles.coverPage}>
      <View style={{ height: 260, backgroundColor: "#0f172a", padding: 40, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {branding?.logoDataUri ? (
            <Image src={branding.logoDataUri} style={{ width: 120, height: 40, objectFit: "contain" }} />
          ) : (
            <Text style={{ fontSize: 16, color: "#ffffff", fontFamily: "Helvetica-Bold" }}>
              {branding?.companyName || "Product Catalogue"}
            </Text>
          )}
        </View>
        <View>
          <Text style={{ fontSize: 30, color: "#ffffff", fontFamily: "Helvetica-Bold" }}>Product Catalogue</Text>
          <Text style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
            Complete range of {totalProducts} product{totalProducts === 1 ? "" : "s"} across {categoryNames.length}{" "}
            categor{categoryNames.length === 1 ? "y" : "ies"}
          </Text>
        </View>
      </View>

      <View style={{ padding: 40 }}>
        <Text style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8", marginBottom: 10 }}>
          Categories Covered
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {categoryNames.slice(0, 24).map((name, i) => (
            <Text key={i} style={[catalogStyles.pillOutline, { borderColor: "#cbd5e1", color: "#475569" }]}>
              {name}
            </Text>
          ))}
        </View>
      </View>

      <View
        style={{
          position: "absolute",
          bottom: 40,
          left: 40,
          right: 40,
          borderTopWidth: 1,
          borderTopColor: "#e2e8f0",
          paddingTop: 10,
        }}
      >
        <Text style={{ fontSize: 8, color: "#94a3b8" }}>
          {branding?.companyName ? `${branding.companyName} — ` : ""}Generated on {generatedOn}
        </Text>
      </View>
    </Page>
  );
}

function ProductsCatalogContent() {
  const searchParams = useSearchParams();
  const globalSearchQuery = searchParams.get("search") || "";
  const urlCategory = searchParams.get("category") || "";
  const urlSubcategory = searchParams.get("subcategory") || "";

  // ---- SETTINGS (live) ----------------------------------------------------
  // Loaded on mount; re-loaded whenever the admin saves (cross-tab event).
  const [settings, setSettings] = useState(loadProductsSettings);
  useEffect(() => {
    const reload = () => setSettings(loadProductsSettings());
    reload(); // hydrate from localStorage after mount
    window.addEventListener("sbs-products-settings-updated", reload);
    window.addEventListener("storage", reload); // other tabs
    return () => {
      window.removeEventListener("sbs-products-settings-updated", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);

  const { layout, card, toggles, rfq } = settings;

  // ---- LIVE DATA (categories / brands / products from backend) ------------
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [allFlattenedProducts, setAllFlattenedProducts] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dataNonce, setDataNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);
    publicCatalogApi
      .getCatalog()
      .then(({ categories, brands, products }) => {
        if (cancelled) return;
        setCategories(categories);
        setBrands(brands);
        setAllFlattenedProducts(products);
        setLoadError("");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load catalog:", err);
        setLoadError("Could not load products. Please try again.");
      })
      .finally(() => !cancelled && setLoadingData(false));
    return () => {
      cancelled = true;
    };
  }, [dataNonce]);

  // Optional silent auto-refresh (re-fetch from API).
  useEffect(() => {
    const secs = toggles?.autoRefreshSeconds || 0;
    if (!secs || secs < 1) return;
    const t = setInterval(() => setDataNonce((n) => n + 1), secs * 1000);
    return () => clearInterval(t);
  }, [toggles?.autoRefreshSeconds]);

  // Inline live search (2+ chars, auto-searches, no Enter needed)
  const [liveSearch, setLiveSearch] = useState("");

  // Pagination (size from settings)
  const PRODUCTS_PER_PAGE = layout?.productsPerPage || 20;
  const [currentPage, setCurrentPage] = useState(1);

  // RFQ cart state (shared across the whole site via RfqCartContext)
  const { cart: rfqCart, addItem: addRfqItem, removeItem: removeRfqItem, updateQuantity: updateRfqQuantity, clearCart: clearRfqCart } = useRfqCart();
  const [quantities, setQuantities] = useState({});
  const [showFormModal, setShowFormModal] = useState(false);

  // Sidebar selection state
  const [expandedCategories, setExpandedCategories] = useState({});
  const [selectedItems, setSelectedItems] = useState({});

  // Brand filter
  const [distributorFilter, setDistributorFilter] = useState(searchParams.get("distributor") || "ALL");

  // ------- NEW: PDF Download Loading State ----------------
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null); // {stage:'images'|'building', done, total}

  // Keep `distributor` in the URL alongside the existing category/subcategory/search
  // params so a fully-filtered product view (incl. distributor tab) is shareable.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (distributorFilter && distributorFilter !== "ALL") params.set("distributor", distributorFilter);
    else params.delete("distributor");
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distributorFilter]);

  // Support ?brand=<id> deep-links (e.g. from a Brand detail page's
  // "See All Products" CTA) — same underlying filter as the sidebar dropdown.
  useEffect(() => {
    const urlBrand = searchParams.get("brand");
    if (urlBrand) setDistributorFilter(urlBrand);
  }, [searchParams]);

  // Dynamic RFQ form data — keyed by each configured field.key
  const initialFormData = useMemo(() => {
    const o = {};
    (rfq?.fields || []).forEach((f) => {
      o[f.key] = "";
    });
    return o;
  }, [rfq?.fields]);
  const [formData, setFormData] = useState(initialFormData);
  useEffect(() => setFormData(initialFormData), [initialFormData]);

  // ⬇️⬇️⬇️ FIXED: Pre-apply sidebar selection from ?category=&subcategory= ⬇️⬇️⬇️
  useEffect(() => {
    if (!urlCategory && !urlSubcategory) return;
    
    // ✅ Wait until categories are loaded from API before trying to find them
    if (categories.length === 0) return;

    const category = categories.find((c) => c.id === urlCategory);
    if (!category) return;

    setExpandedCategories((prev) => ({ ...prev, [category.id]: true }));
    setSelectedItems((prev) => {
      const updated = { ...prev };
      if (urlSubcategory) {
        const sub = category.subcategories.find((s) => s.id === urlSubcategory);
        if (sub) updated[sub.id] = true;
        const allChecked = category.subcategories.every((s) => updated[s.id]);
        if (allChecked) updated[category.id] = true;
      } else {
        updated[category.id] = true;
        category.subcategories.forEach((s) => {
          updated[s.id] = true;
        });
      }
      return updated;
    });
  }, [urlCategory, urlSubcategory, categories]); // ✅ Added 'categories' as dependency

  const handleToggleCategory = (categoryId) =>
    setExpandedCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));

  const handleSelectCategory = (categoryId) => {
    setSelectedItems((prev) => {
      const updated = { ...prev };
      const category = categories.find((c) => c.id === categoryId);
      if (updated[categoryId]) {
        delete updated[categoryId];
        category?.subcategories.forEach((sub) => delete updated[sub.id]);
      } else {
        updated[categoryId] = true;
        category?.subcategories.forEach((sub) => (updated[sub.id] = true));
      }
      return updated;
    });
  };

  const handleSelectSubcategory = (categoryId, subcategoryId) => {
    setSelectedItems((prev) => {
      const updated = { ...prev };
      if (updated[subcategoryId]) delete updated[subcategoryId];
      else updated[subcategoryId] = true;
      const category = categories.find((c) => c.id === categoryId);
      if (category) {
        const allChecked = category.subcategories.every((sub) => updated[sub.id]);
        if (allChecked) updated[categoryId] = true;
        else delete updated[categoryId];
      }
      return updated;
    });
  };

  const subcategoryIdSet = useMemo(() => {
    const set = new Set();
    categories.forEach((c) =>
      (c.subcategories || []).forEach((s) => set.add(s.id))
    );
    return set;
  }, [categories]);

  // All category IDs — used to detect a "whole category" selection (either a
  // category with subcategories that's fully checked, or a leaf category with
  // no subcategories at all) so the filter engine can match on categoryId too.
  const categoryIdSet = useMemo(
    () => new Set(categories.map((c) => c.id)),
    [categories]
  );

  // Categories with zero subcategories — selecting one of these has nothing to
  // narrow further, so it's a meaningful filter tag on its own (unlike a
  // category-with-subcategories checkbox, which is just a shortcut for "all
  // its subcategories are checked").
  const leafCategoryIdSet = useMemo(() => {
    const set = new Set();
    categories.forEach((c) => {
      if (!(c.subcategories || []).length) set.add(c.id);
    });
    return set;
  }, [categories]);

  const getSelectedCount = () =>
    Object.keys(selectedItems).filter(
      (key) => subcategoryIdSet.has(key) || leafCategoryIdSet.has(key)
    ).length;

  const handleQtyChange = (productId, value) => {
    const qty = Math.max(1, parseInt(value) || 1);
    setQuantities((prev) => ({ ...prev, [productId]: qty }));
  };

  const [variantPickerProduct, setVariantPickerProduct] = useState(null);

  const addToRfqCart = (product) => {
    if (product.variants?.length > 0) {
      setVariantPickerProduct(product);
      return;
    }
    const selectedQty = quantities[product.id] || 1;
    const existingItem = rfqCart.find((item) => item.id === product.id);
    if (existingItem) {
      updateRfqQuantity(product.id, selectedQty);
    } else {
      addRfqItem({ ...product }, selectedQty);
    }
    alert(`Successfully appended ${selectedQty} units of ${product.id} to your Quote Bucket.`);
  };

  const removeFromCart = (id) => removeRfqItem(id);

  const handleQuoteSubmission = async (e) => {
    e.preventDefault();
    if (rfqCart.length === 0) {
      alert("Your Quote bucket is empty.");
      return;
    }

    // The form fields are admin-configured (rfq.fields, keyed by f.key). Map the
    // well-known keys onto the backend's fixed columns; everything else is kept
    // in customFields so nothing is lost.
    const known = ["fullName", "companyName", "email", "mobile", "address", "remarks"];
    const customFields = {};
    Object.entries(formData || {}).forEach(([k, v]) => {
      if (!known.includes(k) && v !== "" && v != null) customFields[k] = v;
    });

    const payload = {
      fullName: formData.fullName || formData.name || "",
      companyName: formData.companyName || undefined,
      email: formData.email || "",
      mobile: formData.mobile || formData.phone || "",
      address: formData.address || undefined,
      remarks: formData.remarks || formData.message || undefined,
      customFields: Object.keys(customFields).length ? customFields : undefined,
      items: rfqCart.map((item) => ({
        productId: item.productId || item.id,
        quantity: item.quantity || 1,
        variantId: item.variantId || undefined,
      })),
    };

    try {
      await rfqApi.submit(payload);
      alert(
        `Thank you, ${payload.fullName || ""}! Your quotation request for ${rfqCart.length} item line${rfqCart.length !== 1 ? "s" : ""} has been submitted.`
      );
      clearRfqCart();
      setShowFormModal(false);
      setFormData(initialFormData);
    } catch (err) {
      console.error("RFQ submission failed:", err);
      alert("Sorry, your request could not be submitted: " + err.message);
    }
  };

  // Brands available within the current category/subcategory selection (or all if none).
  const availableDistributors = useMemo(() => {
    const activeCatIds = Object.keys(selectedItems).filter((k) => categoryIdSet.has(k));
    const activeSubcatIds = Object.keys(selectedItems).filter((k) => subcategoryIdSet.has(k));
    const scope =
      activeCatIds.length > 0 || activeSubcatIds.length > 0
        ? allFlattenedProducts.filter(
            (p) =>
              activeCatIds.includes(p.categoryId) ||
              activeSubcatIds.includes(p.subcategoryId)
          )
        : allFlattenedProducts;
    const ids = [...new Set(scope.map((p) => p.distributorId))];
    return brands.filter((d) => ids.includes(d.id));
  }, [allFlattenedProducts, selectedItems, brands, categoryIdSet, subcategoryIdSet]);

  // ============================ FILTER ENGINE ============================
  // A product is shown if it matches the active category selection OR the
  // active subcategory selection:
  //  - Category with NO subcategories, selected → matches by categoryId.
  //  - Category WITH subcategories, selected as a whole (all subs auto-checked)
  //    → matches by categoryId, which also covers any product filed directly
  //    under the category with no subcategory of its own.
  //  - One or more specific subcategories checked (category not "whole") →
  //    matches only products in those exact subcategories.
  const finalVisibleProducts = useMemo(() => {
    const activeCatIds = Object.keys(selectedItems).filter((key) => categoryIdSet.has(key));
    const activeSubcatIds = Object.keys(selectedItems).filter((key) => subcategoryIdSet.has(key));
    const hasSelectionFilter = activeCatIds.length > 0 || activeSubcatIds.length > 0;
    const liveQuery = liveSearch.trim();
    const effectiveQuery = liveQuery.length >= 2 ? liveQuery : globalSearchQuery;
    const query = effectiveQuery.toLowerCase().trim();

    return allFlattenedProducts.filter((product) => {
      if (hasSelectionFilter) {
        const matchesCategory = activeCatIds.includes(product.categoryId);
        const matchesSubcategory = activeSubcatIds.includes(product.subcategoryId);
        if (!matchesCategory && !matchesSubcategory) return false;
      }
      if (distributorFilter !== "ALL" && product.distributorId !== distributorFilter)
        return false;
      if (query) {
        return (
          (product.name || "").toLowerCase().includes(query) ||
          (product.id || "").toLowerCase().includes(query) ||
          (product.keyFeatures || "").toLowerCase().includes(query) ||
          ((typeof product.brand === "object" ? product.brand?.name : product.brand) || "").toLowerCase().includes(query) ||
          (product.model || "").toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [allFlattenedProducts, selectedItems, distributorFilter, globalSearchQuery, liveSearch, categoryIdSet, subcategoryIdSet]);

  // Pagination math
  const totalPages = Math.max(1, Math.ceil(finalVisibleProducts.length / PRODUCTS_PER_PAGE));
  const pageStart = (currentPage - 1) * PRODUCTS_PER_PAGE;
  const paginatedProducts = toggles?.showPagination
    ? finalVisibleProducts.slice(pageStart, pageStart + PRODUCTS_PER_PAGE)
    : finalVisibleProducts;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedItems, distributorFilter, globalSearchQuery, liveSearch, PRODUCTS_PER_PAGE]);

  // ---- derived style values from settings ---------------------------------
  const gridColsClass = COLS_CLASS[layout?.cardsPerRow] || COLS_CLASS[3];
  const gridGapClass = GAP_CLASS[layout?.gap] || GAP_CLASS.md;
  const cardStyleClass = CARD_STYLE_CLASS[card?.style] || CARD_STYLE_CLASS.elevated;
  const imageRatioClass = RATIO_CLASS[card?.imageRatio] || RATIO_CLASS.square;
  const containerWidth = layout?.maxWidth || "max-w-6xl";

  // ------- PDF GENERATION FUNCTION ------------------------------------------
  const downloadCatalogue = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadProgress(null);

    try {
      // Prepare data: map each product to a clean object with a valid image
      // URL plus the fields the layouts need (category label, specs, certs).
      const productsForPDF = allFlattenedProducts.map((product) => ({
        ...product,
        imageUrl: getProductImage(product),
        brandName: typeof product.brand === "object" ? product.brand?.name : product.brand,
        categoryLabel:
          (typeof product.category === "object" ? product.category?.name : "") ||
          categories.find((c) => c.id === product.categoryId)?.name ||
          "Product",
        specifications: Array.isArray(product.specifications) ? product.specifications : [],
        certifications: Array.isArray(product.certifications) ? product.certifications : [],
      }));

      // 1. Preload every product image, converting it to a react-pdf-safe
      //    JPEG data URI (see the note above CATALOGUE PDF GENERATION on why
      //    WebP source images broke this before).
      const imageMap = await preloadCatalogueImages(productsForPDF, (done, total) =>
        setDownloadProgress({ stage: "images", done, total })
      );

      // 2. Pull site branding for the cover page — best-effort; a missing or
      //    failed fetch just falls back to a plain cover.
      let branding = {};
      try {
        const cfg = await headerApi.get();
        branding = cfg?.branding || {};
        if (branding?.logoUrl) {
          branding.logoDataUri = await loadImageAsDataUri(branding.logoUrl, { maxDim: 400 });
        }
      } catch {
        /* keep default cover */
      }

      setDownloadProgress({ stage: "building" });

      // 3. Assign each product a layout theme, shuffled so consecutive pages
      //    never repeat the same design.
      const themeCycle = shuffledThemeCycle(productsForPDF.length);
      const categoryNames = [...new Set(productsForPDF.map((p) => p.categoryLabel).filter(Boolean))];
      const generatedOn = new Date().toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      // Build the PDF Document component — one page per product, each in a
      // randomly-assigned layout, preceded by a branded cover page.
      const PdfDocument = () => (
        <Document>
          <CoverPage
            branding={branding}
            totalProducts={productsForPDF.length}
            categoryNames={categoryNames}
            generatedOn={generatedOn}
          />
          {productsForPDF.map((product, i) => {
            const theme = themeCycle[i];
            const LayoutComponent = CATALOG_LAYOUT_COMPONENTS[theme.layout];
            return (
              <LayoutComponent
                key={product.id}
                product={product}
                dataUri={imageMap[product.id]}
                theme={theme}
                index={i + 1}
                total={productsForPDF.length}
              />
            );
          })}
        </Document>
      );

      // Generate the PDF blob
      const asBlob = await pdf(PdfDocument()).toBlob();

      // Trigger download
      const url = URL.createObjectURL(asBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "product-catalogue.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate catalogue. Please try again.");
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  };


  return (
    <div
      className="min-h-screen font-sans antialiased text-slate-800"
      style={{ backgroundColor: layout?.pageBackground || "#f8fafc" }}
    >
      {/* BREADCRUMB */}
      <PageBreadcrumb pageKey="products" title="Products" items={[{ label: "Products" }]} />

      {/* HEADER SECTION */}
      <div className="bg-white border-b border-slate-200 sticky top-24 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight mt-0.5">Our Products</h1>
            <div className="flex items-end gap-3 self-start sm:self-center">
              {toggles?.showSearch && (
                <div className="flex flex-col">
                  <div className="relative">
                    <input type="text" value={liveSearch} onChange={(e) => setLiveSearch(e.target.value)} placeholder="Type 2+ characters to search..." className="text-xs font-semibold text-slate-800 border border-slate-300 rounded-lg pl-8 pr-7 py-2 bg-white focus:outline-none focus:border-blue-900 min-w-[180px]" />
                    {liveSearch && (
                      <button onClick={() => setLiveSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 font-bold text-xs" aria-label="Clear search" >✕</button>
                    )}
                  </div>
                </div>
              )}

              {toggles?.showBrandFilter && (
                <div className="flex flex-col">
                  <select value={distributorFilter} onChange={(e) => setDistributorFilter(e.target.value)} className="text-xs font-bold text-slate-800 border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-blue-900 min-w-[150px]" >
                    <option value="ALL">All Brands</option>
                    {availableDistributors.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {globalSearchQuery && (
                <div className="bg-blue-50 border border-blue-200 text-blue-900 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 self-end">
                  <span>Filter: <b className="font-black">"{globalSearchQuery}"</b></span>
                  <Link href="/products" className="text-red-500 hover:text-red-700 font-bold ml-2 border-l border-blue-200 pl-2 uppercase tracking-wide text-[10px]">Clear ×</Link>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* ✅ DYNAMIC PDF GENERATOR BUTTON — shows live image-loading / build progress */}
            <button
              onClick={downloadCatalogue}
              disabled={downloading}
              className="text-blue-900 font-bold text-xs px-5 py-3 rounded-xl uppercase tracking-wider border-2 border-blue-900 flex items-center gap-2 hover:bg-blue-50 transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading
                ? downloadProgress?.stage === "images"
                  ? `⏳ Loading images ${downloadProgress.done}/${downloadProgress.total}`
                  : "⏳ Building PDF…"
                : "⬇ Download Catalogue"}
            </button>

            {/* {toggles?.showQuoteBucketButton && rfq?.enabled && (
              <button onClick={() => {
                  if (rfqCart.length === 0) {
                    alert("Your Quote bucket is empty.");
                    return;
                  }
                  setShowFormModal(true);
                }}
                className="text-white font-bold text-xs px-5 py-3 rounded-xl uppercase tracking-wider shadow-lg flex items-center space-x-3 hover:opacity-90 transition-all transform active:scale-95 whitespace-nowrap"
                style={{ backgroundColor: rfq?.buttonColor || "#172554" }} >
                <span>📋</span>
                <span>{rfq?.buttonText || "Quote Bucket"}</span>
                <span className="bg-lime-400 text-slate-950 rounded-md px-1.5 py-0.5 font-black text-[10px]">{rfqCart.length} Lines</span>
              </button>
            )} */}
          </div>
        </div>
      </div>

      {/* VIEW ENGINE LAYOUT CONTROLLER */}
      {loadingData ? (
        <div className="p-16 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Loading live catalog…</div>
      ) : loadError ? (
        <div className="p-16 text-center">
          <p className="text-sm font-bold text-red-600">{loadError}</p>
          <button onClick={() => setDataNonce((n) => n + 1)} className="mt-4 text-xs font-black uppercase tracking-wider border border-slate-300 rounded-lg px-4 py-2 hover:bg-slate-50" >Retry</button>
        </div>
      ) : (
      <div className="flex flex-col md:flex-row gap-0">
        {/* LEFT NAVIGATION SIDEBAR */}
        {toggles?.showSidebar && (
          <div className="w-full md:w-80 bg-white border-r border-slate-200 overflow-y-auto max-h-[calc(100vh-140px)] sticky top-35">
            <div className="p-4">
              <div className="mb-4 pb-4 border-b border-slate-200">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Categories</h2>
                <p className="text-[10px] text-slate-500 font-medium">
                  Active Selection Tags:{" "}
                  <span className="font-black text-blue-900">{getSelectedCount()}</span>
                </p>
              </div>

              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category.id} className="space-y-1">
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <input type="checkbox" checked={!!selectedItems[category.id]} onChange={() => handleSelectCategory(category.id)} className="w-4 h-4 rounded border-slate-300 cursor-pointer accent-blue-900" />
                      <button onClick={() => handleToggleCategory(category.id)} className="flex-1 text-left flex items-center justify-between hover:text-blue-900 transition-colors" >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{category.icon}</span>
                          <span className="text-xs font-black text-slate-900 uppercase tracking-wide">{category.name}</span>
                        </div>
                        <span className="text-xs text-slate-400">{expandedCategories[category.id] ? "▼" : "▶"}</span>
                      </button>
                    </div>

                    {expandedCategories[category.id] && (
                      <div className="pl-8 space-y-1">
                        {category.subcategories.map((subcategory) => (
                          <div key={subcategory.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-blue-50 transition-colors bg-slate-50">
                            <input type="checkbox" checked={!!selectedItems[subcategory.id]} onChange={() =>
                                handleSelectSubcategory(category.id, subcategory.id)
                              }
                              className="w-3 h-3 rounded border-slate-300 cursor-pointer accent-blue-900" />
                            <span className="flex-1 text-xs font-semibold text-slate-700">{subcategory.name}</span>
                            <span className="text-[9px] text-slate-500 font-medium">({subcategory.productCount})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {getSelectedCount() > 0 && (
                <button onClick={() => setSelectedItems({})} className="w-full mt-6 text-xs font-bold text-slate-600 hover:text-slate-900 py-2 px-3 rounded-lg border border-slate-300 transition-colors" >✕ Clear Selection Filters</button>
              )}
            </div>
          </div>
        )}

        {/* MAIN PRODUCT CATALOG REGION */}
        <div className="flex-1 p-4 md:p-8">

          {/* DYNAMIC FEED GRID */}
          {finalVisibleProducts.length > 0 ? (
            <>
              <div className={`${containerWidth} mx-auto grid grid-cols-5 ${gridGapClass}`}>
                {paginatedProducts.map((product) => {
                  const currentInputQty = quantities[product.id] || 0;
                  const isAlreadyInCart = rfqCart.some((item) => item.id === product.id);
                  const imageUrl = getProductImage(product);

                  return (
                    <div
                      key={product.id}
                      className={`flex flex-col ${card?.cornerRadius || "rounded-2xl"} ${cardStyleClass} transition-shadow relative overflow-hidden group`}
                      style={{ backgroundColor: card?.cardBackground || "#ffffff" }}
                    >
                      {/* ✅ FIXED HEIGHT IMAGE AREA – no padding, no empty space, no cropping */}
                      <div
                        className={`relative w-full h-40 bg-slate-50 border-b border-slate-100`}
                        style={{ backgroundColor: card?.imageBackground || "#f8fafc" }}
                      >
                        {imageUrl ? (
                          <LazyCacheImage
                            src={imageUrl}
                            alt={product.name}
                            className="w-full h-full object-fill"   // ← forces stretch to fill, no cutting
                          />
                        ) : (
                          <span className="text-4xl text-slate-300">📦</span>
                        )}
                        {product.isPrelaunch && (
                          <span className="absolute top-2 left-2 text-[9px] font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded tracking-wide shadow-sm">
                            🚀 Coming Soon
                          </span>
                        )}
                        {card?.showBrandBadge && (
                          <span className="absolute top-2 right-2 text-[9px] font-black uppercase bg-white/90 backdrop-blur text-slate-600 px-2 py-0.5 rounded tracking-wide border border-slate-200">
                            {typeof product.brand === "object" ? product.brand?.name : product.brand}
                          </span>
                        )}
                      </div>

                      {/* ✅ COMPACT CARD BODY – smaller padding, smaller text */}
                      <div className="p-3 flex flex-col flex-1">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight transition-colors group-hover:[color:var(--accent)]" style={{ "--accent": card?.accentColor || "#1e3a8a" }}>
                          {product.name}
                        </h3>

                        <div className="mt-auto pt-3 border-t border-slate-100 flex flex-col space-y-2">
                          {rfq?.enabled && (
                            <div className="flex items-center gap-2">
                              <div className="w-16 shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  value={currentInputQty}
                                  onChange={(e) => handleQtyChange(product.id, e.target.value)}
                                  className="w-full text-center font-bold text-xs border border-slate-200 rounded-lg py-1.5 focus:outline-none focus:border-blue-950 bg-slate-50"
                                />
                              </div>
                              <button
                                onClick={() => addToRfqCart(product)}
                                className={`flex-1 text-[9px] font-black uppercase tracking-wider py-1.5 rounded-lg transition-colors border ${
                                  isAlreadyInCart
                                    ? "bg-lime-500 text-slate-900 border-lime-500"
                                    : "bg-slate-900 text-white hover:bg-slate-800 border-slate-900"
                                }`}
                              >
                                {isAlreadyInCart ? "🔄 Update" : "➕ Add"}
                              </button>
                            </div>
                          )}

                          <Link href={`/products/${product.id}`}>
                            <button className="w-full text-[9px] font-black text-blue-600 uppercase tracking-wider py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors">
                              Details
                            </button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* PAGINATION */}
              {toggles?.showPagination && totalPages > 1 && (
                <div className={`${containerWidth} mx-auto mt-10 flex flex-col sm:flex-row items-center justify-between gap-4`}>
                  <p className="text-[11px] font-semibold text-slate-400">
                    Showing{" "}
                    <span className="font-black text-slate-700">
                      {pageStart + 1}–
                      {Math.min(pageStart + PRODUCTS_PER_PAGE, finalVisibleProducts.length)}
                    </span>{" "}
                    of{" "}
                    <span className="font-black text-slate-700">
                      {finalVisibleProducts.length}
                    </span>{" "}
                    items
                  </p>

                  <div className="flex items-center gap-1.5">
                    <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-xs font-black px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" >
                      ← Prev
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`text-xs font-black w-9 h-9 rounded-lg border transition-colors ${
                          pageNum === currentPage
                            ? "bg-blue-950 text-white border-blue-950"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`} >
                        {pageNum}
                      </button>
                    ))}

                    <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-xs font-black px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center max-w-md mx-auto mt-12 shadow-sm">
              <span className="text-3xl">📦</span>
              <h3 className="text-sm font-black text-slate-900 tracking-tight mt-3">No matching items indexed</h3>
              <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">We couldn't locate any catalog entry matching your query criteria.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {/* RFQ MODAL — fields rendered dynamically from settings */}
      {showFormModal && rfq?.enabled && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="text-white px-6 py-4 flex justify-between items-center shrink-0" style={{ backgroundColor: rfq?.buttonColor || "#172554" }} >
              <h2 className="text-sm font-black uppercase tracking-wider">Compile Procurement RFQ Slip</h2>
              <button onClick={() => setShowFormModal(false)} className="text-white/60 hover:text-white font-bold text-sm" >✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
              <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Items Bundled Inside Order Line ({rfqCart.length})</p>
                <div className="divide-y divide-slate-200/60 max-h-36 overflow-y-auto pr-1">
                  {rfqCart.map((item) => (
                    <div key={item.id} className="py-2 flex justify-between items-center text-xs">
                      <div className="truncate max-w-sm"><span className="font-bold text-slate-900">{item.name}</span></div>
                      <div className="flex items-center space-x-3 shrink-0">
                        <span className="bg-blue-50 text-blue-900 font-black px-2 py-0.5 rounded text-[10px]">QTY: {item.quantity} Units</span>
                        <button onClick={() => removeFromCart(item.id)} className="text-rose-500 font-bold text-xs" >🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleQuoteSubmission} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(rfq?.fields || [])
                    .filter((f) => f.show && f.type !== "textarea")
                    .map((f) => (
                      <input key={f.key} type={f.type || "text"} required={!!f.required} value={formData[f.key] ?? ""} onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })} placeholder={f.label} className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 font-medium bg-slate-50" />
                    ))}
                </div>

                {(rfq?.fields || [])
                  .filter((f) => f.show && f.type === "textarea")
                  .map((f) => (
                    <textarea key={f.key} rows={3} required={!!f.required} value={formData[f.key] ?? ""} onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value }) } placeholder={f.label} className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 font-medium bg-slate-50" />
                  ))}

                <button type="submit" className="w-full text-white font-black text-xs py-3 rounded-xl uppercase tracking-wider" style={{ backgroundColor: rfq?.buttonColor || "#172554" }} >
                  {rfq?.submitText || "🚀 Dispatch Quotation Slip"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {variantPickerProduct && (
        <VariantPickerModal product={variantPickerProduct} onClose={() => setVariantPickerProduct(null)} />
      )}
    </div>
  );
}

export default function PublicProductsCatalog() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Initialising Procurement Data Grid...</div>
      }
    >
      <ProductsCatalogContent />
    </Suspense>
  );
}