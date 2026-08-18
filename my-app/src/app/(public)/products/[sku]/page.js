// Server component wrapper — provides SEO metadata (title/description/OG tags)
// server-side, then renders the full interactive client experience unchanged.
// See ProductDetailClient.jsx for the actual page (it reads the :sku param
// itself via useParams(), so nothing needs to be passed down).
import ProductDetailClient from "./ProductDetailClient";

async function fetchProduct(sku) {
  try {
    const base = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
    const res = await fetch(`${base}/products/${encodeURIComponent(sku)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? json ?? null;
  } catch {
    return null;
  }
}

const stripHtml = (html) =>
  (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export async function generateMetadata({ params }) {
  const { sku } = await params;
  const product = await fetchProduct(sku);
  if (!product) {
    return { title: "Product Not Found" };
  }

  const title = product.metaTitle?.trim() || `${product.name}${product.model ? ` – ${product.model}` : ""}`;
  const description =
    product.metaDescription?.trim() ||
    stripHtml(product.description).slice(0, 160) ||
    `${product.name} — available from SBS Groups. Request a quote today.`;
  const image = product.images?.[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/products/${sku}` },
    openGraph: {
      title,
      description,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function Page() {
  return <ProductDetailClient />;
}
