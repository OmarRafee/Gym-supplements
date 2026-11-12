import "./styles-redesign.css";
import "./product-image-fallback.css";
import "./musashi-hero.css";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Dumbbell, Flame, Menu, Minus, Plus, ShoppingBag, Target, X, Zap } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { calculateCartSummary, normalizeCouponPreview } from "./lib/store-math.mjs";

gsap.registerPlugin(ScrollTrigger);

type Product = {
  id: string;
  name: string;
  slug?: string;
  sku?: string | null;
  brand?: string | null;
  size_label?: string | null;
  servings?: number | null;
  ingredients?: string | null;
  directions?: string | null;
  warnings?: string | null;
  is_featured?: boolean;
  category: string;
  description: string;
  price: number;
  cost_price?: number | null;
  compare_at_price?: number | null;
  reorder_level?: number;
  stock: number;
  image_url: string | null;
  is_active?: boolean;
  is_visible?: boolean;
  name_ar?: string | null;
  description_ar?: string | null;
};

type SiteContentRow = { key:string; en:string|null; ar:string|null; image_url:string|null; updated_at?:string };
type Coupon = { id:string; code:string; description:string|null; discount_type:"percentage"|"fixed"; discount_value:number; minimum_order:number; maximum_discount:number|null; usage_limit:number|null; used_count:number; starts_at:string|null; ends_at:string|null; is_active:boolean };
type StoreCategory = { id:string; name:string; slug:string; description:string|null; image_url:string|null; sort_order:number; is_active:boolean };
type AdminOrder = {
  id: string;
  order_number: string | null;
  full_name: string;
  phone: string;
  address: string;
  city: string;
  status: string;
  payment_method: string;
  payment_status: string;
  payment_reference: string | null;
  tracking_number: string | null;
  subtotal: number;
  shipping_fee: number;
  discount_total: number;
  total: number;
  created_at: string;
  order_items?: { product_name: string; quantity: number; line_total: number }[];
};

const money = (value: number) => new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(value);
const toLocalDateTime = (value?: string | null) => { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset()*60000).toISOString().slice(0,16); };

function App() {
  const heroRef = useRef<HTMLElement>(null);
  const bottleRef = useRef<HTMLDivElement>(null);
  const creatinePhotoRef = useRef<HTMLImageElement>(null);
  const [theme, setTheme] = useState<"dark"|"light">(() => window.localStorage.getItem("musashi-theme") === "light" ? "light" : "dark");
  const [language, setLanguage] = useState<"en"|"ar">(() => window.localStorage.getItem("musashi-language") === "ar" ? "ar" : "en");
  const isArabic = language === "ar";
  const tr = (en: string, ar: string) => isArabic ? ar : en;
  const [siteContent, setSiteContent] = useState<Record<string,SiteContentRow>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [motivationIndex, setMotivationIndex] = useState(0);
  const [heroQuoteIndex, setHeroQuoteIndex] = useState(0);
  const [username, setUsername] = useState("");
  const [usernameEdited, setUsernameEdited] = useState(false);
  const heroQuotes = ["BUILT FOR THE WORK.", "EARN YOUR NEXT REP.", "STRENGTH IS A STANDARD.", "SHOW UP. GET STRONGER.", "NO SHORTCUTS. JUST PROGRESS."];
  const motivationNotes = [
    { line: "Strength is earned one honest rep at a time.", tag: "DISCIPLINE" },
    { line: "Show up tired. Start small. Finish stronger.", tag: "CONSISTENCY" },
    { line: "Your competition is yesterday’s effort.", tag: "PROGRESS" },
    { line: "Recovery is training. Respect the rest.", tag: "RECOVERY" },
  ];
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("forme-cart") || "{}");
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved).filter(([key,value]) => typeof key === "string" && Number.isInteger(value) && Number(value) > 0 && Number(value) <= 50)) as Record<string, number>;
    } catch { return {}; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const checkoutLockRef = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [notice, setNotice] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<"overview" | "products" | "orders" | "customers" | "inventory" | "discounts" | "categories" | "content" | "settings">("overview");
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [adminCustomers, setAdminCustomers] = useState<any[]>([]);
  const [adminInventory, setAdminInventory] = useState<any[]>([]);
  const [adminCoupons, setAdminCoupons] = useState<Coupon[]>([]);
  const [adminCategories, setAdminCategories] = useState<StoreCategory[]>([]);
  const [adminSettings, setAdminSettings] = useState<Record<string, any>>({});
  const [dashboardStats, setDashboardStats] = useState<Record<string, any>>({});
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [orderConfirmation, setOrderConfirmation] = useState<{order_number:string|null,total:number,subtotal:number,shipping_fee:number,discount_total:number,payment_method:string,full_name:string,phone:string,city:string,address:string,items:{name:string,quantity:number,unit_price:number,line_total:number}[]}|null>(null);
  const [myOrdersOpen, setMyOrdersOpen] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [myOrdersLoading, setMyOrdersLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [category, setCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    try { window.localStorage.setItem("forme-cart", JSON.stringify(cart)); } catch { /* Storage may be unavailable in private browsing. */ }
  }, [cart]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language;
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
    try { window.localStorage.setItem("musashi-theme", theme); window.localStorage.setItem("musashi-language", language); } catch { /* Preferences remain usable if storage is blocked. */ }
  }, [theme, language, isArabic]);
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const loadSiteContent = async () => {
      const { data, error } = await supabase!.from("site_content").select("key,en,ar,image_url,updated_at");
      if (!active) return;
      if (error) { setNotice("Site content could not be loaded: " + error.message); return; }
      setSiteContent(Object.fromEntries((data ?? []).map((row:any) => [row.key,row as SiteContentRow])));
    };
    void loadSiteContent();
    const channel = supabase.channel("musashi-site-content-live").on("postgres_changes", { event:"*", schema:"public", table:"site_content" }, () => { void loadSiteContent(); }).subscribe();
    return () => { active = false; void supabase?.removeChannel(channel); };
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setHeroQuoteIndex(index => (index + 1) % heroQuotes.length), 2800);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setMotivationIndex(index => (index + 1) % motivationNotes.length), 4200);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!usernameEdited) setUsername(email.includes("@") ? email.split("@")[0] : "");
  }, [email, usernameEdited]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const title = document.querySelector(".hero-rotating-title");
    if (title) gsap.fromTo(title, { y: 24, opacity: 0, filter: "blur(8px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: .62, ease: "power3.out" });
  }, [heroQuoteIndex]);

  useEffect(() => {
    if (!supabase) { setProductsLoading(false); return; }
    const client = supabase;
    let active = true;
    const loadProducts = async () => {
      const { data, error } = await client.from("products")
        .select("id,name,name_ar,description_ar,slug,sku,category,description,price,compare_at_price,stock,image_url,brand,size_label,servings,ingredients,directions,warnings,is_active,is_visible,is_featured")
        .eq("is_visible", true).order("is_featured", { ascending: false }).order("created_at", { ascending: false });
      if (!active) return;
      if (error) setNotice("Catalogue connection error: " + error.message);
      else setProducts((data ?? []) as Product[]);
      setProductsLoading(false);
    };
    void loadProducts();
    const productChannel = client.channel("store-product-catalogue")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => { void loadProducts(); })
      .subscribe();
    client.rpc("get_public_store_settings").then(({data}) => {
      if (active && data) setAdminSettings(data as Record<string,any>);
    });
    const syncUser = async (userId: string | null, userEmailValue: string | null) => {
      if (!active) return;
      setUserEmail(userEmailValue);
      if (!userId) { setIsAdmin(false); setAdminOpen(false); return; }
      const { data: adminRow, error: adminError } = await client
        .from("admins").select("user_id").eq("user_id", userId).maybeSingle();
      if (active) setIsAdmin(!adminError && Boolean(adminRow));
    };
    client.auth.getSession().then(({ data }) => {
      void syncUser(data.session?.user.id ?? null, data.session?.user.email ?? null);
    });
    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
      void syncUser(session?.user.id ?? null, session?.user.email ?? null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); void client.removeChannel(productChannel); };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (!reducedMotion) {
        const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
        intro.from(".nav-inner", { y: -18, opacity: 0, duration: 0.65 })
          .from(".hero-copy > *", { y: 24, opacity: 0, duration: 0.65, stagger: 0.09 }, "-=0.25")
          .from(bottleRef.current, { y: 24, opacity: 0, duration: 0.9, ease: "power2.out" }, "-=0.35");
        // Product photography remains fixed; motion belongs to the surrounding atmosphere.
        gsap.to(".visual-orbit.orbit-one", { scale: 1.035, opacity: 0.72, ease: "none", scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 0.6 } });
        gsap.to(".hero-visual:before", { yPercent: -8, ease: "none", scrollTrigger: { trigger: heroRef.current, start: "top top", end: "bottom top", scrub: 0.6 } });
        gsap.utils.toArray<HTMLElement>(".shelf-tier-track").forEach(track => {
          gsap.fromTo(track, { x: 18 }, { x: -18, ease: "none", scrollTrigger: { trigger: track, start: "top 88%", end: "bottom 18%", scrub: 0.35 } });
        });
        gsap.to(".ticker-track", { xPercent: -25, duration: 24, repeat: -1, ease: "none" });
        gsap.utils.toArray<HTMLElement>(".strength-signs article, .motivation-note, .product-card, .trust-strip > div, .journal-card, .faq-list details, .reveal").forEach((element,index) => {
          gsap.from(element, { y: 30, opacity: 0, duration: 0.7, delay: (index % 4) * 0.035, ease: "power3.out", scrollTrigger: { trigger: element, start: "top 91%", once: true } });
        });
      }
    });
    return () => ctx.revert();
  }, []);

  async function loadAdminData() {
    if (!supabase || !isAdmin) return;
    setAdminLoading(true);
    const [productResult, orderResult, customerResult, inventoryResult, couponResult, categoryResult, settingsResult, statsResult] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("id,order_number,full_name,phone,address,city,status,payment_method,payment_status,payment_reference,tracking_number,subtotal,shipping_fee,discount_total,total,created_at,order_items(product_name,quantity,line_total)").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id,email,full_name,phone,address,city,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("inventory_movements").select("id,product_id,order_id,movement_type,quantity_change,stock_before,stock_after,reason,created_at,products(name,sku)").order("created_at", { ascending: false }).limit(100),
      supabase.from("coupons").select("*").order("created_at", { ascending: false }),
      supabase.from("product_categories").select("*").order("sort_order").order("name"),
      supabase.from("store_settings").select("setting_key,setting_value"),
      supabase.rpc("admin_dashboard_stats"),
    ]);
    if (productResult.error) setNotice("Products: " + productResult.error.message);
    else setAdminProducts((productResult.data ?? []) as Product[]);
    if (orderResult.error) setNotice("Orders: " + orderResult.error.message);
    else setAdminOrders((orderResult.data ?? []) as AdminOrder[]);
    if (customerResult.error) setNotice("Customers: " + customerResult.error.message);
    else {
      const { data: adminRows } = await supabase.from("admins").select("user_id");
      const adminIds = new Set((adminRows ?? []).map((row:any) => row.user_id));
      setAdminCustomers((customerResult.data ?? []).filter((customer:any) => !adminIds.has(customer.id)));
    }
    if (inventoryResult.error) setNotice("Inventory: " + inventoryResult.error.message);
    else setAdminInventory(inventoryResult.data ?? []);
    if (couponResult?.error) setNotice("Discounts: " + couponResult.error.message);
    else setAdminCoupons((couponResult?.data ?? []) as Coupon[]);
    if (categoryResult?.error) setNotice("Categories: " + categoryResult.error.message);
    else setAdminCategories((categoryResult?.data ?? []) as StoreCategory[]);
    if (settingsResult?.data) setAdminSettings(Object.fromEntries(settingsResult.data.map((item:any) => [item.setting_key,item.setting_value])));
    if (statsResult?.error) setNotice("Dashboard: " + statsResult.error.message);
    else setDashboardStats(statsResult?.data ?? {});
    setAdminLoading(false);
  }


  async function loadMyOrders() {
    if (!supabase) return;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) { setAuthMode("login"); setAuthOpen(true); return; }
    setMyOrdersLoading(true);
    const { data, error } = await supabase.from("orders")
      .select("id,order_number,status,payment_status,payment_method,total,created_at,tracking_number,order_items(product_name,quantity,line_total)")
      .order("created_at",{ascending:false}).limit(30);
    if (error) setNotice(error.message); else setMyOrders(data ?? []);
    setMyOrdersLoading(false);
    setMyOrdersOpen(true);
  }

  async function previewCoupon() {
    if (!supabase || !couponCode.trim()) { setCouponMessage("Enter a code first."); return; }
    const { data, error } = await supabase.rpc("preview_coupon", { p_code: couponCode.trim(), p_subtotal: cartTotal });
    if (error) { setCouponDiscount(0); setCouponMessage(error.message); return; }
    const result = Array.isArray(data) ? data[0] : data;
    const normalized = normalizeCouponPreview(result, cartTotal);
    if (!normalized.valid) { setCouponDiscount(0); setCouponMessage(normalized.message); return; }
    setCouponDiscount(normalized.discount);
    setCouponMessage(normalized.message);
  }

  async function saveAdminCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const starts = String(form.get("starts_at") || "");
    const ends = String(form.get("ends_at") || "");
    const payload = {
      code: String(form.get("code") || "").trim().toUpperCase(),
      description: String(form.get("description") || "").trim() || null,
      discount_type: String(form.get("discount_type") || "percentage"),
      discount_value: Number(form.get("discount_value")),
      minimum_order: Number(form.get("minimum_order") || 0),
      maximum_discount: form.get("maximum_discount") ? Number(form.get("maximum_discount")) : null,
      usage_limit: form.get("usage_limit") ? Number(form.get("usage_limit")) : null,
      starts_at: starts ? new Date(starts).toISOString() : null,
      ends_at: ends ? new Date(ends).toISOString() : null,
      is_active: form.get("is_active") === "on",
    };
    if (!/^[A-Z0-9_-]{3,32}$/.test(payload.code) || !Number.isFinite(payload.discount_value) || payload.discount_value <= 0 ||
      payload.minimum_order < 0 || (payload.discount_type === "percentage" && payload.discount_value > 100) ||
      (payload.maximum_discount !== null && payload.maximum_discount <= 0) ||
      (payload.usage_limit !== null && (!Number.isInteger(payload.usage_limit) || payload.usage_limit < 1)) ||
      (starts && ends && new Date(ends) <= new Date(starts))) {
      setNotice("Check the discount code, value, limits and schedule."); return;
    }
    const editingId = String(form.get("id") || "");
    const result = editingId
      ? await supabase.from("coupons").update(payload).eq("id", editingId)
      : await supabase.from("coupons").insert(payload);
    if (result.error) { setNotice(result.error.message); return; }
    setNotice(editingId ? "Discount updated." : "Discount created.");
    await loadAdminData();
    setEditingCoupon(null);
    formElement.reset();
  }

  async function toggleCoupon(coupon: Coupon) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("coupons").update({ is_active: !coupon.is_active }).eq("id", coupon.id);
    if (error) setNotice(error.message); else { setNotice(coupon.is_active ? "Discount paused." : "Discount activated."); await loadAdminData(); }
  }

  async function saveAdminCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") || "").trim();
    const slug = String(form.get("slug") || "").trim().toLowerCase() || name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    if (!name || !slug) { setNotice("Enter a category name."); return; }
    const id = String(form.get("id") || "");
    const payload = { name, slug, description: String(form.get("description") || "").trim() || null, sort_order: Number(form.get("sort_order") || 0), is_active: true };
    const result = id ? await supabase.from("product_categories").update(payload).eq("id",id) : await supabase.from("product_categories").insert(payload);
    if (result.error) setNotice(result.error.message); else {
      if (id && editingCategory && editingCategory.name !== name) {
        const renameResult = await supabase.from("products").update({ category: name }).eq("category", editingCategory.name);
        if (renameResult.error) { setNotice("Category saved, but products could not be renamed: " + renameResult.error.message); }
      } else setNotice("Category saved.");
      setEditingCategory(null); formElement.reset(); await loadAdminData();
    }
  }

  async function toggleCategory(item: StoreCategory) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("product_categories").update({ is_active: !item.is_active }).eq("id",item.id);
    if (error) setNotice(error.message); else { setNotice(item.is_active ? "Category hidden." : "Category restored."); await loadAdminData(); }
  }

  async function saveSiteContent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    const form = new FormData(event.currentTarget);
    let heroImageUrl = siteContent.hero_photo?.image_url || null;
    const heroFile = form.get("hero_photo_file");
    if (heroFile instanceof File && heroFile.size > 0) {
      if (!/^image\\/(jpeg|png|webp|avif)$/.test(heroFile.type) || heroFile.size > 8 * 1024 * 1024) { setNotice("Hero image must be JPG, PNG, WEBP or AVIF and no larger than 8 MB."); return; }
      const safeName = heroFile.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
      const objectPath = `homepage/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("site-media").upload(objectPath, heroFile, { contentType: heroFile.type, cacheControl: "31536000", upsert: false });
      if (uploadError) { setNotice("Hero image upload failed: " + uploadError.message); return; }
      heroImageUrl = supabase.storage.from("site-media").getPublicUrl(objectPath).data.publicUrl;
    }
    const keys = ["announcement","hero_eyebrow","hero_title","hero_line_two","hero_subtitle","hero_cta","shelves_title","shelves_subtitle","promise_1_title","promise_1_body","promise_2_title","promise_2_body","promise_3_title","promise_3_body","about_title","about_body","journal_title","footer_text"];
    const records = keys.map(key => ({ key, en: String(form.get(`${key}_en`) || "").trim(), ar: String(form.get(`${key}_ar`) || "").trim(), image_url: siteContent[key]?.image_url || null }));
    records.push({ key:"hero_photo", en:null, ar:null, image_url:heroImageUrl } as any);
    const { error } = await supabase.from("site_content").upsert(records, { onConflict:"key" });
    if (error) { setNotice("Site content could not be saved: " + error.message); return; }
    const { data, error:refreshError } = await supabase.from("site_content").select("key,en,ar,image_url,updated_at");
    if (refreshError) { setNotice("Content saved, but refresh failed: " + refreshError.message); return; }
    setSiteContent(Object.fromEntries((data ?? []).map((row:any) => [row.key,row as SiteContentRow])));
    setNotice("Website content saved to Supabase and synced to visitors.");
  }

  async function saveStoreSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    const form = new FormData(event.currentTarget);
    let heroImageUrl = adminSettings.homepage?.hero_image_url || null;
    const heroFile = form.get("hero_image");
    if (heroFile instanceof File && heroFile.size > 0) {
      if (!/^image\/(jpeg|png|webp|avif)$/.test(heroFile.type) || heroFile.size > 8 * 1024 * 1024) { setNotice("Hero image must be JPG, PNG, WEBP or AVIF and no larger than 8 MB."); return; }
      const safeName = heroFile.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
      const objectPath = `homepage/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("site-media").upload(objectPath, heroFile, { contentType: heroFile.type, cacheControl: "31536000", upsert: false });
      if (uploadError) { setNotice("Hero image upload failed: " + uploadError.message); return; }
      heroImageUrl = supabase.storage.from("site-media").getPublicUrl(objectPath).data.publicUrl;
    }
    const records = [
      { setting_key: "store_profile", setting_value: { store_name: String(form.get("store_name") || "MUSASHI").trim(), support_email: String(form.get("support_email") || "").trim(), support_phone: String(form.get("support_phone") || "").trim(), currency: "EGP", country: "Egypt" }, description: "Public store identity and contact details" },
      { setting_key: "shipping", setting_value: { standard_fee: Number(form.get("standard_fee") || 0), free_shipping_threshold: Number(form.get("free_shipping_threshold") || 0), estimated_delivery: String(form.get("estimated_delivery") || "").trim() }, description: "Checkout delivery pricing and estimate" },
      { setting_key: "homepage", setting_value: { ...(adminSettings.homepage || {}), announcement: String(form.get("announcement") || "").trim(), hero_title: String(form.get("hero_title") || "").trim(), hero_subtitle: String(form.get("hero_subtitle") || "").trim(), kicker: String(form.get("hero_kicker") || "").trim(), hero_line_one: String(form.get("hero_line_one") || "").trim(), hero_line_two: String(form.get("hero_line_two") || "").trim(), hero_subtitle_ar: String(form.get("hero_subtitle_ar") || "").trim(), kicker_ar: String(form.get("hero_kicker_ar") || "").trim(), hero_line_one_ar: String(form.get("hero_line_one_ar") || "").trim(), hero_line_two_ar: String(form.get("hero_line_two_ar") || "").trim(), strength_title: String(form.get("strength_title") || "").trim(), strength_title_ar: String(form.get("strength_title_ar") || "").trim(), strength_subtitle: String(form.get("strength_subtitle") || "").trim(), strength_subtitle_ar: String(form.get("strength_subtitle_ar") || "").trim(), manifesto_title: String(form.get("manifesto_title") || "").trim(), manifesto_title_ar: String(form.get("manifesto_title_ar") || "").trim(), manifesto_body: String(form.get("manifesto_body") || "").trim(), manifesto_body_ar: String(form.get("manifesto_body_ar") || "").trim(), journal_title: String(form.get("journal_title") || "").trim(), journal_title_ar: String(form.get("journal_title_ar") || "").trim(), closing_title: String(form.get("closing_title") || "").trim(), closing_title_ar: String(form.get("closing_title_ar") || "").trim(), hero_image_url: heroImageUrl }, description: "Bilingual homepage content and hero media" },
      { setting_key: "social", setting_value: { instagram_url: String(form.get("instagram_url") || "").trim(), facebook_url: String(form.get("facebook_url") || "").trim(), whatsapp_number: String(form.get("whatsapp_number") || "").trim() }, description: "Store social and support links" },
      { setting_key: "legal", setting_value: { legal_name: String(form.get("legal_name") || "").trim(), business_address: String(form.get("business_address") || "").trim(), commercial_register: String(form.get("commercial_register") || "").trim(), tax_number: String(form.get("tax_number") || "").trim(), return_policy: String(form.get("return_policy") || "").trim(), privacy_policy: String(form.get("privacy_policy") || "").trim(), terms_conditions: String(form.get("terms_conditions") || "").trim(), shipping_policy: String(form.get("shipping_policy") || "").trim() }, description: "Seller legal details and customer-facing policy" },
      { setting_key: "payments", setting_value: { instapay_alias: String(form.get("instapay_alias") || "").trim(), account_name: String(form.get("instapay_account_name") || "").trim(), instructions: String(form.get("instapay_instructions") || "").trim() }, description: "Manual payment instructions" },
    ];
    if (records.some((record:any) => Object.values(record.setting_value).some((value:any) => typeof value === "number" && (!Number.isFinite(value) || value < 0)))) {
      setNotice("Shipping values must be valid non-negative numbers."); return;
    }
    const { error } = await supabase.from("store_settings").upsert(records, { onConflict: "setting_key" });
    if (error) setNotice(error.message); else { setNotice("Store settings saved."); await loadAdminData(); }
  }

  async function saveAdminProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const slug = String(form.get("slug") ?? "").trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const payload = {
      name, name_ar: String(form.get("name_ar") ?? "").trim() || null, description_ar: String(form.get("description_ar") ?? "").trim() || null, slug,
      sku: String(form.get("sku") ?? "").trim() || null,
      brand: String(form.get("brand") ?? "").trim() || null,
      size_label: String(form.get("size_label") ?? "").trim() || null,
      category: String(form.get("category") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      price: Number(form.get("price")),
      is_visible: form.get("is_visible") === "on",
      is_active: form.get("is_active") === "on",
      cost_price: form.get("cost_price") ? Number(form.get("cost_price")) : null,
      compare_at_price: form.get("compare_at_price") ? Number(form.get("compare_at_price")) : null,
      stock: Number(form.get("stock")),
      reorder_level: Number(form.get("reorder_level") || 5),
      servings: form.get("servings") ? Number(form.get("servings")) : null,
      ingredients: String(form.get("ingredients") ?? "").trim() || null,
      directions: String(form.get("directions") ?? "").trim() || null,
      warnings: String(form.get("warnings") ?? "").trim() || null,
      is_featured: form.get("is_featured") === "on",
      image_url: editingProduct?.image_url ?? null,
    };
    if (!name || !payload.category || !Number.isFinite(payload.price) || payload.price < 0 || !Number.isInteger(payload.stock) || payload.stock < 0) {
      setNotice("Check the product name, category, price and stock values.");
      return;
    }
    const imageFile = form.get("product_image");
    if (imageFile instanceof File && imageFile.size > 0) {
      if (!/^image\/(jpeg|png|webp|avif)$/.test(imageFile.type) || imageFile.size > 5 * 1024 * 1024) { setNotice("Choose a JPG, PNG, WEBP or AVIF image up to 5 MB."); return; }
      const safeName = imageFile.name.toLowerCase().replace(/[^a-z0-9.-]+/g, "-");
      const objectPath = `products/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from("product-images").upload(objectPath, imageFile, { contentType: imageFile.type, cacheControl: "31536000", upsert: false });
      if (uploadError) { setNotice("Image upload failed: " + uploadError.message); return; }
      payload.image_url = supabase.storage.from("product-images").getPublicUrl(objectPath).data.publicUrl;
    }
    const result = editingProduct
      ? await supabase.from("products").update(payload).eq("id", editingProduct.id)
      : await supabase.from("products").insert(payload);
    if (result.error) { setNotice(result.error.message); return; }
    setEditingProduct(null);
    formElement.reset();
    setNotice(editingProduct ? "Product updated." : "Product added.");
    await loadAdminData();
    await refreshStoreProducts();
  }

  async function setAdminProductVisibility(id: string, currentVisible: boolean) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("products").update({ is_visible: !currentVisible }).eq("id", id);
    if (error) setNotice(error.message);
    else { setNotice(currentVisible ? "Product hidden from the catalogue." : "Product restored to the catalogue."); await loadAdminData(); await refreshStoreProducts(); }
  }

  async function refreshStoreProducts() {
    if (!supabase) return;
    const { data, error } = await supabase.from("products")
      .select("id,name,slug,sku,category,description,price,compare_at_price,stock,image_url,brand,size_label,servings,ingredients,directions,warnings,is_active,is_visible,is_featured")
      .eq("is_visible", true).order("is_featured", { ascending: false }).order("created_at", { ascending: false });
    if (error) setNotice("Catalogue refresh failed: " + error.message);
    else setProducts((data ?? []) as Product[]);
  }

  async function updateAdminOrder(id: string, field: "status" | "payment_status" | "tracking_number" | "payment_reference", value: string) {
    if (!supabase || !isAdmin) return;
    const result = field === "status"
      ? await supabase.rpc("admin_set_order_status", { p_order: id, p_status: value })
      : await supabase.from("orders").update({ [field]: value || null }).eq("id", id);
    if (result.error) setNotice(result.error.message);
    else { setNotice("Order updated."); await loadAdminData(); }
  }

  async function updateAdminShipping(id: string, value: string) {
    if (!supabase || !isAdmin) return;
    const order = adminOrders.find(item => item.id === id);
    const shipping = Number(value);
    if (!order || !Number.isFinite(shipping) || shipping < 0) { setNotice("Enter a valid non-negative shipping fee."); return; }
    const total = Number(order.subtotal) + shipping - Number(order.discount_total || 0);
    const { error } = await supabase.from("orders").update({ shipping_fee: shipping, total }).eq("id", id);
    if (error) setNotice(error.message);
    else { setNotice("Shipping fee and order total updated."); await loadAdminData(); }
  }

  const categories = ["ALL", ...Array.from(new Set(products.map((product) => product.category?.toUpperCase() ?? "OTHER")))];
  const visibleProducts = products.filter((product) => (category === "ALL" || product.category?.toUpperCase() === category) && (!searchQuery.trim() || (product.name+" "+(product.description ?? "")+" "+(product.category ?? "")+" "+(product.brand ?? "")).toLowerCase().includes(searchQuery.trim().toLowerCase())));
  const cartItems = products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] }));
  const shippingSettings = adminSettings.shipping ?? { standard_fee: 60, free_shipping_threshold: 1500, estimated_delivery: "2–5 business days" };
  const cartSummary = calculateCartSummary(cartItems, shippingSettings, couponDiscount);
  const cartTotal = cartSummary.subtotal;
  const estimatedShipping = cartSummary.shipping;
  const checkoutTotal = cartSummary.total;
  const hasUnavailableCartItems = Object.keys(cart).length !== cartItems.length;
  useEffect(() => { setCouponDiscount(0); setCouponMessage(""); }, [cart]);
  const addToCart = (id: string) => {
    const product = products.find((item) => item.id === id);
    if (!product?.is_active) { setNotice("This product is on display. Availability will be confirmed soon."); return; }
    if (!product || product.stock <= 0) { setNotice("This product is currently out of stock."); return; }
    if ((cart[id] ?? 0) >= product.stock) { setNotice("You have reached the available stock for this product."); return; }
    setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  };
  const changeQuantity = (id: string, delta: number) => setCart((current) => {
    const product = products.find((item) => item.id === id);
    const next = (current[id] ?? 0) + delta;
    if (delta > 0 && product && next > product.stock) { setNotice("Only " + product.stock + " units are available."); return current; }
    const updated = { ...current };
    if (next <= 0) delete updated[id]; else updated[id] = next;
    return updated;
  });


  async function handleCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Capture the form and all checkout values synchronously. React/browser events
    // no longer guarantee currentTarget is available after the first await.
    const form = new FormData(event.currentTarget);
    const checkoutItems = cartItems.map(item => ({ ...item, quantity: Number(item.quantity) }));
    const checkoutSubtotal = checkoutItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const checkoutShipping = calculateCartSummary(checkoutItems, shippingSettings).shipping;
    const fullName = String(form.get("full_name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const address = String(form.get("address") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const chosenPayment = String(form.get("payment_method") ?? "cod");

    if (isSubmittingOrder || checkoutLockRef.current) return;
    if (!supabase) { setNotice("Connect Supabase to place an order."); return; }
    if (!checkoutItems.length || Object.keys(cart).length !== checkoutItems.length) {
      setNotice("Your bag contains unavailable items. Remove them and try again."); return;
    }
    const unavailable = checkoutItems.find(item => !item.is_active || !item.is_visible || Number(item.stock) < item.quantity || item.quantity < 1);
    if (unavailable) {
      setNotice(Number(unavailable.stock) < unavailable.quantity
        ? unavailable.name + " no longer has enough stock. Update your bag."
        : unavailable.name + " is not currently available for purchase.");
      return;
    }
    if (fullName.length < 2 || phone.replace(/[^0-9]/g, "").length < 7 || address.length < 5 || city.length < 2) {
      setNotice("Please enter a valid full name, phone number, city and complete delivery address."); return;
    }
    if (chosenPayment !== "cod") {
      setNotice("Choose a supported payment method."); return;
    }

    checkoutLockRef.current = true;
    setIsSubmittingOrder(true);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) { setNotice("We couldn't verify your account. Please sign in again."); return; }
      if (!sessionData.session) {
        setCheckoutOpen(false); setAuthMode("login"); setAuthOpen(true);
        setNotice("Please sign in before checkout. Your bag has been saved."); return;
      }

      // Always validate a typed coupon at the final checkout step. The database
      // validates it again inside place_order while locking the coupon row.
      let finalDiscount = 0;
      const finalCouponCode = couponCode.trim();
      if (finalCouponCode) {
        const { data: couponData, error: couponError } = await supabase.rpc("preview_coupon", {
          p_code: finalCouponCode, p_subtotal: checkoutSubtotal
        });
        const coupon = Array.isArray(couponData) ? couponData[0] : couponData;
        if (couponError || !coupon?.valid) {
          setCouponDiscount(0);
          setCouponMessage(couponError?.message || coupon?.message || "This discount code is not valid for this order.");
          setNotice("Please correct or remove the discount code before placing your order.");
          return;
        }
        const normalizedCoupon = normalizeCouponPreview(coupon, checkoutSubtotal);
        finalDiscount = normalizedCoupon.discount;
        setCouponDiscount(finalDiscount);
        setCouponMessage(normalizedCoupon.message);
      }

      const payload = {
        p_items: checkoutItems.map(item => ({ product_id: item.id, quantity: item.quantity })),
        p_full_name: fullName,
        p_phone: phone,
        p_address: address,
        p_city: city,
        p_payment_method: chosenPayment,
        p_notes: String(form.get("notes") ?? "").trim(),
      };
      const { data: orderId, error } = await supabase.rpc("place_order", {
        ...payload, p_coupon_code: finalCouponCode || null
      });
      if (error) { setNotice(error.message); return; }
      if (!orderId) {
        setNotice("The order service returned no order reference. Check My Account before trying again.");
        return;
      }

      // The RPC is the source of truth for price, discount, shipping and stock.
      const { data: placedOrder, error: receiptError } = await supabase.from("orders")
        .select("order_number,total,subtotal,shipping_fee,discount_total,order_items(product_name,quantity,unit_price,line_total)")
        .eq("id", orderId).maybeSingle();

      setCart({});
      setCouponCode(""); setCouponDiscount(0); setCouponMessage("");
      setCheckoutOpen(false);
      setCartOpen(false);
      setOrderConfirmation({
        order_number: placedOrder?.order_number ?? String(orderId).slice(0, 8),
        total: Number(placedOrder?.total ?? calculateCartSummary(checkoutItems, shippingSettings, finalDiscount).total),
        subtotal: Number(placedOrder?.subtotal ?? checkoutSubtotal),
        shipping_fee: Number(placedOrder?.shipping_fee ?? checkoutShipping),
        discount_total: Number(placedOrder?.discount_total ?? finalDiscount),
        payment_method: chosenPayment,
        full_name: fullName, phone, city, address,
        items: placedOrder?.order_items?.length ? placedOrder.order_items.map((item:any) => ({ name:item.product_name, quantity:Number(item.quantity), unit_price:Number(item.unit_price), line_total:Number(item.line_total) })) : checkoutItems.map(item => ({ name:item.name, quantity:item.quantity, unit_price:Number(item.price), line_total:Number(item.price)*item.quantity }))
      });
      setNotice(receiptError
        ? "Your order was placed. You can find its full details in My Account."
        : "Order placed successfully. Your order reference is ready.");
      if (receiptError) void loadMyOrders();
    } catch (error) {
      setNotice(error instanceof Error ? "Checkout failed: " + error.message : "Checkout failed. Please try again.");
    } finally {
      checkoutLockRef.current = false;
      setIsSubmittingOrder(false);
    }
  }

  async function sendPasswordReset() {
    if (!supabase || !email.trim()) { setNotice("Enter your account email first."); return; }
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) setNotice(error.message);
    else { setAuthOpen(false); setNotice("Password reset email sent. Open the link in your inbox to choose a new password."); }
  }

  async function handlePasswordRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    if (newPassword.length < 8) { setNotice("Use at least 8 characters for your new password."); return; }
    if (newPassword !== confirmPassword) { setNotice("The passwords do not match."); return; }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setNotice(error.message);
    else { setRecoveryMode(false); setNewPassword(""); setConfirmPassword(""); setNotice("Your password has been updated. You can now access the admin dashboard."); }
  }

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setNotice("Connect your Supabase environment variables to enable accounts."); return; }
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { full_name: username.trim() || email.split("@")[0] } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setNotice(result.error.message);
    else {
      setNotice(authMode === "signup" ? "Account created. Check your email if confirmation is enabled." : "Welcome back.");
      setAuthOpen(false);
      if (result.data.session && cartItems.length > 0) setCheckoutOpen(true);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="nav-inner">
          <a className="wordmark musashi-wordmark" href="#top">MUSASHI<span>®</span></a>
          <nav className={menuOpen ? "main-nav is-open" : "main-nav"}>
            <a href="#top" onClick={() => setMenuOpen(false)}>{tr("Home","الرئيسية")}</a>
            <a href="#shop" onClick={() => setMenuOpen(false)}>{tr("Products","المنتجات")}</a>
            <a href="#philosophy" onClick={() => setMenuOpen(false)}>{tr("About","عن المتجر")}</a>
            <a href="#account" onClick={(e) => {e.preventDefault();setMenuOpen(false);if(userEmail)void loadMyOrders();else{setAuthMode("login");setAuthOpen(true);}}}>{tr("Account","حسابي")}</a>
          </nav>
          <div className="nav-actions">
            <button className="preference-toggle" type="button" onClick={() => setLanguage(language === "en" ? "ar" : "en")} aria-label="Change language">{language === "en" ? "عربي" : "EN"}</button>
            <button className="preference-toggle theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Change colour theme">{theme === "dark" ? "☼" : "☾"}</button>
            {isAdmin && <button className="text-button admin-nav-button" onClick={() => { setAdminOpen(true); setAdminTab("overview"); void loadAdminData(); }}>ADMIN</button>}
            <button className="text-button account-button" onClick={() => { if (userEmail) void loadMyOrders(); else { setAuthMode("login"); setAuthOpen(true); } }}>{userEmail ? "MY ACCOUNT" : "SIGN IN / JOIN"}</button>
            <button className="bag-button" aria-label="Open cart" onClick={() => setCartOpen(true)}><ShoppingBag size={17}/><span>Bag ({Object.values(cart).reduce((a,b) => a+b, 0)})</span></button>
            <button className="menu-button" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero" ref={heroRef}>
          
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="hero-kicker">{siteContent.hero_eyebrow?.[language] || (isArabic ? "أطلق إمكاناتك" : "FUEL YOUR POTENTIAL")} <i/></p>
              <h1 className="hero-main-title"><span>{siteContent.hero_title?.[language] || (isArabic ? "بروتين عالي" : "HIGH PROTEIN")}</span><em>{siteContent.hero_line_two?.[language] || (isArabic ? "+ كرياتين" : "+ CREATINE")}</em></h1>
              <p className="hero-tagline">{siteContent.hero_subtitle?.[language] || (isArabic ? "ابنِ العضلات. تعافَ أسرع. أدِّ بشكل أقوى." : "Build Muscle. Recover Faster. Perform Stronger.")}</p>
              <div className="hero-benefits"><div><Dumbbell/><strong>30G</strong><small>{tr("PROTEIN","بروتين")}</small></div><div><Zap/><strong>19</strong><small>{tr("SERVES","حصة")}</small></div><div><Flame/><strong>{tr("RECOVERY","تعافٍ")}</strong><small>{tr("FOR MUSCLE REPAIR","لدعم تعافي العضلات")}</small></div></div>
              <div className="hero-links"><a className="button button-light hero-shop-cta" href="#shop">{siteContent.hero_cta?.[language] || tr("SHOP NOW","تسوق الآن")} <ArrowRight size={20}/></a></div>
            </div>
            <div className="hero-visual">
              <div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
              <div className="hero-product-label"><span>01 / MUSASHI RECOVER</span><span>{tr("HIGH PROTEIN + CREATINE · 900 G","بروتين عالي + كرياتين · 900 جم")}</span></div>
              <div className="creatine-photo-stage" ref={bottleRef}>
                <img ref={creatinePhotoRef} className="creatine-powder-photo musashi-hero-bottle" src={siteContent.hero_photo?.image_url || adminSettings.homepage?.hero_image_url || (import.meta.env.BASE_URL + "musashi-product.svg")} alt="Musashi Recover high protein and creatine 900 gram tub" fetchPriority="high" decoding="async" onLoad={(event) => { event.currentTarget.style.opacity = "1"; const fallback = event.currentTarget.nextElementSibling as HTMLElement | null; if (fallback) fallback.style.display = "none"; event.currentTarget.parentElement?.classList.remove("hero-image-fallback"); }} onError={(event) => { event.currentTarget.style.display = "none"; event.currentTarget.parentElement?.classList.add("hero-image-fallback"); }} />
                <div className="hero-fallback-tub" aria-hidden="true"><span className="fallback-cap"/><span className="fallback-label"><b>MUSASHI</b><strong>RECOVER<br/>HIGH PROTEIN<br/>+ CREATINE</strong><small>30G PROTEIN&nbsp;&nbsp; | &nbsp;&nbsp;19 SERVES</small></span></div>
                <span className="photo-caption">MUSASHI RECOVER · 900 G</span>
              </div>
              <span className="scroll-cue"><ArrowDown size={14}/> {tr("SCROLL TO EXPLORE THE FORMULA","مرر لاستكشاف التركيبة")}</span>
            </div>
          </div>
          <div className="hero-foot"><span>{tr("FORMULATED WITH INTENTION","تركيبة مدروسة بعناية")}</span><span>CAIRO · EGYPT</span><span>01 — 04</span></div>
        </section>

        <div className="ticker"><div className="ticker-track">{Array.from({length: 8}, (_, i) => <span key={i}>{tr("DISCIPLINE IS A DAILY PRACTICE","الانضباط ممارسة يومية")} <b>✳</b> {tr("PERFORMANCE, WITHOUT COMPROMISE","أداء بلا تنازلات")} <b>✳</b></span>)}</div></div>
        <section className="strength-code section-pad" aria-label="Training mindset">
          <div className="strength-heading"><p className="eyebrow">{tr("THE STRENGTH CODE","قواعد القوة")}</p><h2>{isArabic ? (adminSettings.homepage?.strength_title_ar || "تدرّب بهدف واضح") : (adminSettings.homepage?.strength_title || "Train with intent.")}</h2><p>{isArabic ? (adminSettings.homepage?.strength_subtitle_ar || "مبادئ بسيطة. عادات أقوى. تدريبات أفضل.") : (adminSettings.homepage?.strength_subtitle || "Simple principles. Stronger habits. Better sessions.")}</p></div>
          <div className="strength-signs"><article><Dumbbell/><span>01 / {tr("STRENGTH","القوة")}</span><strong>{tr("Earn every rep.","استحق كل تكرار.")}</strong></article><article><Flame/><span>02 / {tr("DRIVE","الحماس")}</span><strong>{tr("Bring the effort.","ابذل جهدك.")}</strong></article><article><Target/><span>03 / {tr("FOCUS","التركيز")}</span><strong>{tr("Keep your aim clear.","حافظ على هدفك.")}</strong></article><article><Zap/><span>04 / {tr("RECOVERY","التعافي")}</span><strong>{tr("Come back ready.","عُد مستعدًا.")}</strong></article></div>
          <div className="motivation-note"><span>{tr("DAILY TRAINING NOTE","ملاحظة التدريب اليومية")} / {motivationNotes[motivationIndex].tag}</span><strong>“{motivationNotes[motivationIndex].line}”</strong><button onClick={() => setMotivationIndex((current) => (current + 1) % motivationNotes.length)}>{tr("NEXT NOTE","الملاحظة التالية")} <ArrowRight size={15}/></button></div>
        </section>

        <section className="shop-section section-pad" id="shop">
          <div className="section-heading reveal"><div><p className="eyebrow">{tr("THE STOCKROOM / LIVE DATABASE","المتجر / المنتجات المتاحة")}</p><h2>{siteContent.shelves_title?.[language] || tr("Gear up. Get stronger.","استعد. كن أقوى.")}</h2></div><p>{siteContent.shelves_subtitle?.[language] || tr("Real catalogue records, clear availability and product details. Only verified stock can be added to your bag.","منتجات حقيقية وتوافر واضح وتفاصيل دقيقة. يمكنك شراء المنتجات المتاحة فقط.")}</p></div>
          <div className="filter-row reveal"><div className="filters">{categories.map((item) => <button key={item} className={category === item ? "filter active" : "filter"} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="shop-search"><span>{tr("SEARCH","بحث")}</span><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder={tr("Find your formula…","ابحث عن منتجك…")}/></label><span>{visibleProducts.length.toString().padStart(2,"0")} {tr("PRODUCTS","منتجات")}</span></div>
          <div className="catalog-status"><span className="live-dot"/> {tr("LIVE CATALOGUE","الكتالوج المباشر")} <b>{products.length} {tr("DATABASE ITEMS","منتجات في قاعدة البيانات")}</b><span>{productsLoading ? tr("SYNCING…","جارٍ التحديث…") : tr("UPDATED LIVE","محدّث الآن")}</span></div>
          <div className="gym-shelf-rows">
            {Array.from({ length: Math.ceil(visibleProducts.length / 3) }, (_, shelfIndex) => (
              <div className="gym-shelf-tier" key={`shelf-${shelfIndex}`}>
                <div className="shelf-tier-track">
                  {visibleProducts.slice(shelfIndex * 3, shelfIndex * 3 + 3).map((product, index) => <article className="product-card reveal" key={product.id}>
              <div className={`product-art art-${(shelfIndex * 3 + index) % 3}`}>
                <span className="product-index">0{shelfIndex * 3 + index + 1} / MUSASHI</span>
                {product.image_url && /^https?:\/\//i.test(product.image_url) ? <img src={product.image_url} alt={product.name} loading="lazy"/> : <div className="product-image-pending"><span>{(product.brand || "MUSASHI").toUpperCase()}</span><strong>OFFICIAL<br/>PRODUCT PHOTO</strong><small>AWAITING VERIFIED IMAGE</small></div>}
                <button className="quick-add" aria-label={!product.is_active ? `View ${product.name}` : `Add ${product.name} to bag`} onClick={() => product.is_active ? addToCart(product.id) : setSelectedProduct(product)}><Plus size={18}/></button>
                <span className="stock-note">{!product.is_active ? tr("COMING SOON","قريبًا") : product.stock > 0 ? `${product.stock} ${tr("UNITS AVAILABLE","وحدات متاحة")}` : tr("SOLD OUT","نفد المخزون")}</span>
              </div>
              <div className="product-meta"><div><span>{product.category?.toUpperCase() ?? "MUSASHI"}</span><h3>{isArabic ? (product.name_ar || product.name) : product.name}</h3></div><div className="product-pricing"><strong>{product.is_active ? money(Number(product.price)) : "AVAILABILITY SOON"}</strong>{product.compare_at_price && product.compare_at_price > product.price && <del>{money(Number(product.compare_at_price))}</del>}</div></div>
              <p className="product-description">{isArabic ? (product.description_ar || product.description) : product.description}</p><button className="product-details-link" onClick={() => setSelectedProduct(product)}>{tr("Product details","تفاصيل المنتج")} <ArrowUpRight size={13}/></button>
            </article>)}
                </div>
                <div className="shelf-front-rail"><span>STOCKROOM / TIER {String(shelfIndex + 1).padStart(2,"0")}</span><i/></div>
              </div>
            ))}
          </div>
          {productsLoading && <div className="catalog-skeletons" aria-label="Loading products">{Array.from({length:3},(_,i)=><div className="catalog-skeleton" key={i}><div/><span/><b/></div>)}</div>}
          {!productsLoading && visibleProducts.length === 0 && <div className="catalog-empty"><span>LIVE STOCKROOM</span><h3>{searchQuery ? "No matching products." : "No products are published yet."}</h3><p>{searchQuery ? "Try another name, brand or category." : "Add or publish products from the admin dashboard. The storefront reads directly from Supabase."}</p>{searchQuery && <button onClick={()=>setSearchQuery("")}>Clear search</button>}</div>}
          <div className="catalog-footnote">Prices and purchase availability are shown only after the store verifies the listing.</div>
        </section>

        <section className="trust-strip" aria-label="Store promises"><div><span>01</span><strong>{tr("Clear product information","معلومات واضحة عن المنتجات")}</strong><small>{tr("Know what you are choosing.","اعرف ما الذي تختاره.")}</small></div><div><span>02</span><strong>{tr("Local delivery","توصيل محلي")}</strong><small>{tr("Egypt-wide delivery options.","خيارات توصيل داخل مصر.")}</small></div><div><span>03</span><strong>{tr("Human support","دعم مباشر")}</strong><small>{tr("Questions? We are here to help.","هل لديك سؤال؟ نحن هنا لمساعدتك.")}</small></div><div><span>04</span><strong>{tr("Secure checkout","دفع آمن")}</strong><small>{tr("Your order is recorded safely.","يتم تسجيل طلبك بأمان.")}</small></div></section>

        <section className="manifesto section-pad" id="philosophy">
          <div className="manifesto-mark reveal">F<span>®</span></div>
          <div className="manifesto-copy reveal"><p className="eyebrow">{tr("A BETTER KIND OF STANDARD","معيار أفضل للأداء")}</p><h2>{isArabic ? (adminSettings.homepage?.manifesto_title_ar || "التقدم يبدأ من التفاصيل") : (adminSettings.homepage?.manifesto_title || "Progress is built in the details.")}</h2><p>{isArabic ? (adminSettings.homepage?.manifesto_body_ar || "نؤمن بأن أفضل روتين للأداء هو ما يمكنك الوثوق به. تركيبات واضحة ومصادر موثوقة ومنتجات تناسب احتياجاتك.") : (adminSettings.homepage?.manifesto_body || "We believe the best performance routine is the one you can trust. Clear formulas, considered sourcing, and products that make sense in the real world.")}</p><a href="#shop" className="underlined-link">Discover our approach <ArrowUpRight size={15}/></a></div>
          <div className="manifesto-side reveal"><span>01 — QUALITY</span><span>02 — CLARITY</span><span>03 — CONSISTENCY</span><span>04 — PROGRESS</span></div>
        </section>

        <section className="journal section-pad" id="journal">
          <div className="journal-head reveal"><p className="eyebrow">{tr("THE MUSASHI JOURNAL","مجلة موشيشي")}</p><h2>{isArabic ? (adminSettings.homepage?.journal_title_ar || "المعرفة جزء من الرحلة") : (adminSettings.homepage?.journal_title || "Knowledge is part of the work.")}</h2><p>{tr("Useful thinking for a stronger everyday.","معرفة مفيدة ليوم أقوى.")}</p></div>
          <div className="journal-cards">
            <article className="journal-card reveal"><span>01 / FOUNDATIONS</span><div className="journal-art journal-art-one">01</div><h3>The case for consistency.</h3><p>Why the small things compound.</p><a href="#shop">READ THE NOTE <ArrowUpRight size={14}/></a></article>
            <article className="journal-card reveal"><span>02 / PERFORMANCE</span><div className="journal-art journal-art-two">02</div><h3>Know what’s in your scoop.</h3><p>A clearer look at protein basics.</p><a href="#shop">READ THE NOTE <ArrowUpRight size={14}/></a></article>
            <article className="journal-card reveal"><span>03 / RECOVERY</span><div className="journal-art journal-art-three">03</div><h3>Rest is part of the plan.</h3><p>Training hard means recovering well.</p><a href="#shop">READ THE NOTE <ArrowUpRight size={14}/></a></article>
          </div>
        </section>

        <section className="faq-section section-pad" id="help"><div className="faq-intro"><p className="eyebrow">{tr("GOOD TO KNOW","معلومات مهمة")}</p><h2>{tr("Questions, answered.","إجابات لأسئلتك.")}</h2><p>{tr("Everything you need to shop with confidence.","كل ما تحتاج معرفته للتسوق بثقة.")}</p>{adminSettings.store_profile?.support_email && <a className="underlined-link" href={"mailto:"+adminSettings.store_profile.support_email}>Email support <ArrowUpRight size={15}/></a>}{adminSettings.social?.whatsapp_number && <a className="underlined-link" href={"https://wa.me/"+String(adminSettings.social.whatsapp_number).replace(/[^0-9]/g,"")} target="_blank" rel="noreferrer">Chat on WhatsApp <ArrowUpRight size={15}/></a>}</div><div className="faq-list"><details><summary>How do I choose the right supplement?<span>+</span></summary><p>Start with your training goal, read each product’s ingredients and serving information, and follow the label directions. Supplements are not a replacement for a balanced diet or professional medical advice.</p></details><details><summary>When will my order arrive?<span>+</span></summary><p>Our current estimated delivery window is {adminSettings.shipping?.estimated_delivery || "2–5 business days"}. We will contact you to confirm your order and delivery details.</p></details><details><summary>Which payment methods are available?<span>+</span></summary><p>Cash on delivery and InstaPay are currently supported. InstaPay transfers are checked manually before an order is marked as paid. Card payments will be added after a payment gateway is connected.</p></details><details><summary>Can I change or cancel an order?<span>+</span></summary><p>Contact our support team as soon as possible with your order reference. Changes depend on whether the order has already been prepared or dispatched.</p></details><details><summary>How do returns work?<span>+</span></summary><p>{adminSettings.legal?.return_policy || "Our returns policy is being finalised. Please contact support before placing an order."}</p></details>{adminSettings.legal?.shipping_policy && <details><summary>Shipping policy<span>+</span></summary><p>{adminSettings.legal.shipping_policy}</p></details>}{adminSettings.legal?.privacy_policy && <details><summary>Privacy policy<span>+</span></summary><p>{adminSettings.legal.privacy_policy}</p></details>}{adminSettings.legal?.terms_conditions && <details><summary>Terms and conditions<span>+</span></summary><p>{adminSettings.legal.terms_conditions}</p></details>}</div></section>

        <section className="closing-cta"><p className="eyebrow">{tr("THE NEXT REP STARTS HERE","تبدأ خطوتك التالية هنا")}</p><h2>{isArabic ? (adminSettings.homepage?.closing_title_ar || "كن حاضرًا. كل يوم.") : (adminSettings.homepage?.closing_title || "Show up. Every day.")}</h2><a href="#shop" className="button button-light">{tr("Shop the collection","تسوق المجموعة")} <ArrowRight size={16}/></a></section>
      </main>

      <footer className="footer"><a className="wordmark" href="#top">{adminSettings.store_profile?.store_name || "MUSASHI"}<span>®</span></a><span>{tr("PERFORMANCE, REFINED.","أداء بلا تنازلات.")}</span><a href="#help">{tr("HELP & DELIVERY","المساعدة والتوصيل")}</a>{adminSettings.social?.instagram_url && <a href={adminSettings.social.instagram_url} target="_blank" rel="noreferrer">INSTAGRAM ↗</a>}<span>© 2026 MUSASHI</span><a href="#top">BACK TO TOP ↑</a></footer>

      {cartOpen && <div className="drawer-backdrop" onClick={() => setCartOpen(false)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">YOUR BAG / REVIEW</p><h2>Your order <span>({cartItems.reduce((sum,item)=>sum+item.quantity,0)} units)</span></h2><small className="bag-subtitle">Review quantities and subtotal before secure checkout.</small></div><button className="icon-button" onClick={() => setCartOpen(false)}><X/></button></div>
        {hasUnavailableCartItems && <div className="bag-unavailable-warning"><strong>Some saved items are no longer in the live catalogue.</strong><span>Remove unavailable items before checkout.</span><button onClick={() => setCart(Object.fromEntries(cartItems.map(item=>[item.id,item.quantity])))}>Remove unavailable items</button></div>}{cartItems.length === 0 ? <div className="empty-state"><ShoppingBag size={30}/><p>Your bag is waiting for something good.</p><button className="underlined-link" onClick={() => setCartOpen(false)}>Explore products <ArrowRight size={14}/></button></div> : <>
          <div className="drawer-items">{cartItems.map((item) => <div className="drawer-item" key={item.id}><div className="drawer-thumb">{item.image_url ? <img src={item.image_url} alt="" /> : <span>F.</span>}</div><div className="drawer-item-info"><strong>{item.name}</strong><span>{money(item.price)}</span><div className="quantity-control"><button onClick={() => changeQuantity(item.id, -1)}><Minus size={13}/></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)}><Plus size={13}/></button></div></div><strong>{money(item.price * item.quantity)}</strong></div>)}</div>
          <div className="drawer-total"><span>SUBTOTAL</span><strong>{money(cartTotal)}</strong></div><div className="bag-cost-preview"><span>Delivery estimate</span><b>{estimatedShipping===0 ? "FREE" : money(estimatedShipping)}</b><small>{estimatedShipping===0 ? "Free delivery threshold reached" : "Final delivery fee confirmed by the store"}</small></div><p className="checkout-note">Final total is calculated securely by the database when you place your order.</p><button className="button button-dark full-button" onClick={async () => { if (hasUnavailableCartItems) { setNotice("Remove unavailable products from your bag before checkout."); return; } setCartOpen(false); const {data} = await supabase?.auth.getSession() ?? {data:{session:null}}; if (data.session) setCheckoutOpen(true); else { setAuthMode("login"); setAuthOpen(true); setNotice("Sign in or create an account to continue. Your bag is saved."); } }}>Continue to checkout <ArrowRight size={16}/></button>
        </>}</aside></div>}


      {myOrdersOpen && <div className="modal-backdrop" onClick={()=>setMyOrdersOpen(false)}><section className="auth-modal my-orders-modal" onClick={event=>event.stopPropagation()}><button className="icon-button modal-close" onClick={()=>setMyOrdersOpen(false)}><X/></button><p className="eyebrow">YOUR MUSASHI ACCOUNT</p><h2>Your orders.</h2><p className="auth-sub">{userEmail}</p>{myOrdersLoading ? <p className="admin-loading">Loading your orders…</p> : myOrders.length ? <div className="my-orders-list">{myOrders.map(order=><article key={order.id}><div className="my-order-heading"><strong>{order.order_number || order.id.slice(0,8)}</strong><span className={"status-pill status-"+order.status}>{order.status === "pending" ? "Received" : order.status}</span></div><small>{new Date(order.created_at).toLocaleDateString()} · {order.payment_method.toUpperCase()}</small>{(order.order_items ?? []).map((item:any,i:number)=><p key={i}>{item.product_name} × {item.quantity}</p>)}<div className="my-order-foot"><b>{money(Number(order.total))}</b><span>{order.payment_status.replaceAll("_"," ")}</span></div>{order.tracking_number && <small>Tracking: {order.tracking_number}</small>}</article>)}</div> : <p className="admin-empty">You haven't placed an order yet. Your next step starts in the collection.</p>}<button className="switch-auth" onClick={async()=>{await supabase?.auth.signOut();setMyOrdersOpen(false);setNotice("You have signed out.");}}>Sign out</button></section></div>}
      {selectedProduct && <div className="modal-backdrop" onClick={() => setSelectedProduct(null)}><section className="product-detail-modal" onClick={event=>event.stopPropagation()}><button className="icon-button modal-close" onClick={()=>setSelectedProduct(null)}><X/></button><div className="product-detail-art">{selectedProduct.image_url ? <img src={selectedProduct.image_url} alt={selectedProduct.name}/> : <div className="mini-tub"><span>{adminSettings.store_profile?.store_name || "MUSASHI"}</span><strong>{selectedProduct.name.toUpperCase()}</strong><small>{selectedProduct.category?.toUpperCase()}</small></div>}</div><div className="product-detail-copy"><p className="eyebrow">{selectedProduct.category?.toUpperCase()} / PRODUCT DETAILS</p><h2>{isArabic ? (selectedProduct.name_ar || selectedProduct.name) : selectedProduct.name}</h2>{selectedProduct.brand && <p className="product-brand">{selectedProduct.brand}</p>}<p>{isArabic ? (selectedProduct.description_ar || selectedProduct.description) : selectedProduct.description}</p><strong className="product-detail-price">{selectedProduct.is_active ? money(Number(selectedProduct.price)) : "AVAILABILITY TO BE CONFIRMED"}</strong>{selectedProduct.size_label && <div className="product-detail-fact"><span>SIZE</span><b>{selectedProduct.size_label}</b></div>}{selectedProduct.servings && <div className="product-detail-fact"><span>SERVINGS</span><b>{selectedProduct.servings}</b></div>}{selectedProduct.ingredients && <div className="product-detail-section"><strong>Ingredients</strong><p>{selectedProduct.ingredients}</p></div>}{selectedProduct.directions && <div className="product-detail-section"><strong>How to use</strong><p>{selectedProduct.directions}</p></div>}{selectedProduct.warnings && <div className="product-detail-section"><strong>Important information</strong><p>{selectedProduct.warnings}</p></div>}<button className="button button-dark full-button" disabled={!selectedProduct.is_active || selectedProduct.stock<=0} onClick={()=>{addToCart(selectedProduct.id);setSelectedProduct(null);}}>{!selectedProduct.is_active ? "Coming soon" : selectedProduct.stock<=0 ? "Out of stock" : "Add to bag"} <ArrowRight size={16}/></button></div></section></div>}
      {checkoutOpen && <div className="modal-backdrop" onClick={() => setCheckoutOpen(false)}><section className="auth-modal checkout-modal" onClick={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={() => setCheckoutOpen(false)}><X/></button><p className="eyebrow">SECURE CHECKOUT</p><h2>Almost yours.</h2><p className="auth-sub">Delivery details · Your order is confirmed after you submit this form.</p>
          <div className="coupon-entry"><div><label htmlFor="checkout-coupon">Discount code</label><div className="coupon-entry-row"><input id="checkout-coupon" value={couponCode} onChange={e => {setCouponCode(e.target.value.toUpperCase());setCouponDiscount(0);setCouponMessage("");}} placeholder="Enter your code"/><button type="button" onClick={() => void previewCoupon()}>Apply</button></div></div>{couponMessage && <small className={couponDiscount > 0 ? "coupon-success" : "coupon-error"}>{couponMessage}</small>}</div>
          <div className="checkout-summary"><span>Subtotal <b>{money(cartTotal)}</b></span><span>Delivery <b>{estimatedShipping===0 ? "FREE" : money(estimatedShipping)}</b></span>{couponDiscount>0 && <span>Discount <b>−{money(couponDiscount)}</b></span>}<strong>Total <b>{money(checkoutTotal)}</b></strong></div>
          <form onSubmit={handleCheckout}><label>Full name<input name="full_name" required minLength={2} placeholder="Your full name"/></label><label>Phone number<input name="phone" required minLength={7} placeholder="+20"/></label><label>City<input name="city" required placeholder="Cairo"/></label><label>Delivery address<input name="address" required minLength={5} placeholder="Street, building, apartment"/></label><input type="hidden" name="payment_method" value="cod"/><div className="checkout-payment-choice"><span>PAYMENT METHOD</span><strong>CASH ON DELIVERY</strong><small>Pay when your order arrives. InstaPay and Visa will be added after their payment integrations are ready.</small></div><label>Delivery notes (optional)<input name="notes" placeholder="Anything we should know?"/></label><button className="button button-dark full-button" type="submit" disabled={isSubmittingOrder || cartItems.length === 0 || hasUnavailableCartItems}>{isSubmittingOrder ? "Submitting order…" : "Place order"} <ArrowRight size={16}/></button></form></section></div>}

      {orderConfirmation && <div className="modal-backdrop"><section className="auth-modal order-success-modal"><div className="success-mark no-print"><Check size={28}/></div><p className="eyebrow">MUSASHI / ORDER RECEIPT</p><h2 className="no-print">Your order is received.</h2><p className="auth-sub no-print">Your order has been saved. Our team will contact you to confirm delivery details.</p><div className="receipt-header"><strong>{adminSettings.legal?.legal_name || adminSettings.store_profile?.store_name || "MUSASHI"}</strong><span>{adminSettings.legal?.business_address || "Seller address to be completed in store settings"}</span><span>CR: {adminSettings.legal?.commercial_register || "Add commercial registration"}</span><span>Tax: {adminSettings.legal?.tax_number || "Add tax registration"}</span><span>{adminSettings.store_profile?.support_email || ""} {adminSettings.store_profile?.support_phone || ""}</span></div><div className="order-reference"><span>ORDER / INVOICE REFERENCE</span><strong>{orderConfirmation.order_number || "Received"}</strong><small>{new Date().toLocaleString()}</small></div><div className="receipt-customer"><strong>Customer</strong><span>{orderConfirmation.full_name}</span><span>{orderConfirmation.phone}</span><span>{orderConfirmation.address}, {orderConfirmation.city}</span></div><div className="receipt-lines">{orderConfirmation.items.map((item,i)=><div key={i}><span>{item.name} × {item.quantity}</span><b>{money(item.line_total)}</b></div>)}</div><div className="receipt-totals"><span>Subtotal <b>{money(orderConfirmation.subtotal)}</b></span><span>Delivery <b>{orderConfirmation.shipping_fee===0?"FREE":money(orderConfirmation.shipping_fee)}</b></span>{orderConfirmation.discount_total>0&&<span>Discount <b>−{money(orderConfirmation.discount_total)}</b></span>}<strong>Total due <b>{money(orderConfirmation.total)}</b></strong><small>Payment: {orderConfirmation.payment_method.toUpperCase()} · Estimated delivery: {adminSettings.shipping?.estimated_delivery || "To be confirmed"}</small></div><p className="receipt-policy">{adminSettings.legal?.return_policy || "Please contact the store for return and exchange terms. Complete this policy in Store Settings before launch."}</p><div className="receipt-actions no-print"><button className="button button-dark" onClick={()=>window.print()}>Print receipt</button><button className="button button-light" onClick={() => setOrderConfirmation(null)}>Continue shopping <ArrowRight size={16}/></button></div></section></div>}
      {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><section className="auth-modal" onClick={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={() => setAuthOpen(false)}><X/></button><p className="eyebrow">WELCOME TO MUSASHI</p><h2>{authMode === "login" ? "Good to see you." : "Start your standard."}</h2><p className="auth-sub">Your account keeps your orders and details in one place.</p><form onSubmit={handleAuth}>{authMode === "signup" && <label>Your name / username<input type="text" value={username} onChange={event => { setUsername(event.target.value); setUsernameEdited(true); }} minLength={2} maxLength={60} required placeholder="Name shown on your account"/></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com"/></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={authMode === "signup" ? 8 : 6} required placeholder={authMode === "signup" ? "At least 8 characters" : "Your password"}/></label><button className="button button-dark full-button" type="submit">{authMode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16}/></button></form>{authMode === "login" && <button className="switch-auth" onClick={() => void sendPasswordReset()}>Forgot password? Send me a reset link</button>}<button className="switch-auth" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button></section></div>}



      {recoveryMode && <div className="modal-backdrop"><section className="auth-modal"><p className="eyebrow">ACCOUNT SECURITY</p><h2>Set a new password.</h2><p className="auth-sub">Choose a strong password with at least 8 characters. Avoid short or easily guessed passwords.</p><form onSubmit={handlePasswordRecovery}><label>New password<input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></label><label>Confirm new password<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></label><button className="button button-dark full-button" type="submit">Update password <ArrowRight size={16}/></button></form></section></div>}
      {adminOpen && isAdmin && <div className="admin-overlay">
        <aside className="admin-sidebar">
          <div className="admin-brand"><span className="admin-brand-mark">F.</span><div><strong>{adminSettings.store_profile?.store_name || "MUSASHI"}</strong><small>STORE CONTROL</small></div></div>
          <div className="admin-nav">
            {(["overview","products","orders","customers","inventory","discounts","categories","content","settings"] as const).map((tab) => <button key={tab} className={adminTab === tab ? "active" : ""} onClick={() => setAdminTab(tab)}>{tab}</button>)}
          </div>
          <div className="admin-sidebar-bottom"><span>{userEmail}</span><button onClick={() => setAdminOpen(false)}>Back to storefront ↗</button><button onClick={async () => { await supabase?.auth.signOut(); setAdminOpen(false); }}>Sign out</button></div>
        </aside>
        <section className="admin-main">
          <header className="admin-topbar"><div><p className="eyebrow">MUSASHI / CONTROL ROOM</p><h1>{adminTab === "overview" ? "Dashboard" : adminTab[0].toUpperCase() + adminTab.slice(1)}</h1></div><div className="admin-top-actions"><button onClick={() => void loadAdminData()}>↻ Refresh</button><button onClick={() => setAdminOpen(false)}>✕ Close</button></div></header>
          {adminLoading && <p className="admin-loading">Updating live store data…</p>}
          {adminTab === "overview" && <div className="admin-content">
            <div className="admin-stat-grid">
              <article><span>ALL ORDERS</span><strong>{Number(dashboardStats.orders_count ?? adminOrders.length)}</strong><small>{Number(dashboardStats.pending_orders ?? 0)} awaiting action</small></article>
              <article><span>GROSS ORDER VALUE</span><strong>{money(Number(dashboardStats.gross_sales ?? 0))}</strong><small>Excludes cancelled orders</small></article>
              <article><span>PAID REVENUE</span><strong>{money(Number(dashboardStats.paid_sales ?? 0))}</strong><small>Payments marked paid</small></article>
              <article><span>ACTIVE CUSTOMERS</span><strong>{Number(dashboardStats.customers_count ?? adminCustomers.length)}</strong><small>Registered profiles</small></article>
              <article><span>ACTIVE PRODUCTS</span><strong>{Number(dashboardStats.active_products ?? 0)}</strong><small>Store catalogue</small></article>
              <article><span>LOW STOCK</span><strong>{Number(dashboardStats.low_stock ?? 0)}</strong><small>At or below reorder level</small></article>
              <article><span>UNITS IN STOCK</span><strong>{Number(dashboardStats.inventory_units ?? 0)}</strong><small>Across active products</small></article>
              <article><span>ACTIVE DISCOUNTS</span><strong>{adminCoupons.filter(c=>c.is_active).length}</strong><small>Promotions enabled</small></article>
            </div>
            <div className="admin-insights-grid"><div className="admin-panel"><div className="admin-panel-head"><h2>Sales trend</h2><small>Last six months · EGP</small></div><div className="admin-sales-chart">{(dashboardStats.monthly_sales ?? []).map((month:any,index:number,all:any[])=>{const max=Math.max(1,...all.map((item:any)=>Number(item.revenue||0)));return <div className="admin-sales-month" key={month.label+index}><div className="admin-sales-bar-wrap"><i style={{height:Math.max(4,Number(month.revenue||0)/max*100)+"%"}}/></div><strong>{money(Number(month.revenue||0))}</strong><span>{month.label}</span></div>;})}{!(dashboardStats.monthly_sales ?? []).length && <p className="admin-empty">Your monthly sales trend will appear after the first orders.</p>}</div></div><div className="admin-panel"><div className="admin-panel-head"><h2>Best sellers</h2><small>By units ordered</small></div>{(dashboardStats.top_products ?? []).map((item:any,index:number)=><div className="admin-row" key={item.name}><div><strong>{index+1}. {item.name}</strong><small>{money(Number(item.revenue||0))} sales</small></div><b>{item.units} units</b></div>)}{!(dashboardStats.top_products ?? []).length && <p className="admin-empty">Product rankings will appear after orders.</p>}</div></div>
            <div className="admin-panel"><div className="admin-panel-head"><h2>Recent orders</h2><button onClick={() => setAdminTab("orders")}>View all ↗</button></div>
              {adminOrders.slice(0,6).map(order => <div className="admin-row" key={order.id}><div><strong>{order.order_number || order.id.slice(0,8)}</strong><small>{order.full_name} · {new Date(order.created_at).toLocaleString()}</small></div><span className={"status-pill status-" + order.status}>{order.status}</span><b>{money(Number(order.total))}</b></div>)}
              {!adminOrders.length && <p className="admin-empty">No real orders yet. New customer checkouts will appear here.</p>}
            </div>
          </div>}
          {adminTab === "products" && <div className="admin-content admin-products-layout">
            <div className="admin-panel admin-editor"><div className="admin-panel-head"><h2>{editingProduct ? "Edit product" : "Add a product"}</h2>{editingProduct && <button onClick={() => setEditingProduct(null)}>Cancel edit</button>}</div>
              <form className="admin-product-form" key={editingProduct?.id ?? "new-product"} onSubmit={saveAdminProduct}>
                <label>Product name<input name="name" required defaultValue={editingProduct?.name ?? ""}/></label>
                <label>Slug<input name="slug" defaultValue={editingProduct?.slug ?? ""} placeholder="auto-generated if blank"/></label>
                <label>SKU<input name="sku" defaultValue={editingProduct?.sku ?? ""}/></label>
                <label>Brand<input name="brand" defaultValue={editingProduct?.brand ?? ""}/></label>
                <label>Category<select name="category" required defaultValue={editingProduct?.category ?? ""}><option value="">Choose category</option>{adminCategories.filter(item=>item.is_active).map(item=><option key={item.id} value={item.name}>{item.name}</option>)}</select></label>
                <label>Size<input name="size_label" defaultValue={editingProduct?.size_label ?? ""} placeholder="2 lb / 900 g"/></label>
                <div className="admin-form-grid"><label>Price (EGP)<input name="price" type="number" min="0" step="0.01" required defaultValue={editingProduct?.price ?? ""}/></label><label>Cost (EGP)<input name="cost_price" type="number" min="0" step="0.01" defaultValue={editingProduct?.cost_price ?? ""}/></label></div>
                <div className="admin-form-grid"><label>Stock<input name="stock" type="number" min="0" step="1" required defaultValue={editingProduct?.stock ?? 0}/></label><label>Reorder at<input name="reorder_level" type="number" min="0" step="1" defaultValue={editingProduct?.reorder_level ?? 5}/></label></div>
                <label>Compare-at price<input name="compare_at_price" type="number" min="0" step="0.01" defaultValue={editingProduct?.compare_at_price ?? ""}/></label>
                <label>Servings<input name="servings" type="number" min="1" step="1" defaultValue={editingProduct?.servings ?? ""}/></label>
                <label>Upload product photo<input name="product_image" type="file" accept="image/jpeg,image/png,image/webp,image/avif"/></label>{editingProduct?.image_url && <div className="admin-image-preview"><img src={editingProduct.image_url} alt="Current product"/> <small>Current image · upload a new file to replace it</small></div>}<label>Arabic product name<input name="name_ar" defaultValue={editingProduct?.name_ar ?? ""}/></label><label>Arabic description<textarea name="description_ar" rows={3} defaultValue={editingProduct?.description_ar ?? ""}/></label>
                <label className="admin-check-label"><input name="is_visible" type="checkbox" defaultChecked={editingProduct?.is_visible ?? true}/> Show in storefront catalogue</label>
                <label className="admin-check-label"><input name="is_active" type="checkbox" defaultChecked={editingProduct?.is_active ?? false}/> Available to purchase (verify price and stock first)</label>
                <label>Description<textarea name="description" rows={3} defaultValue={editingProduct?.description ?? ""}/></label>
                <label>Ingredients<textarea name="ingredients" rows={3} defaultValue={editingProduct?.ingredients ?? ""}/></label>
                <label>How to use<textarea name="directions" rows={2} defaultValue={editingProduct?.directions ?? ""}/></label>
                <label>Warnings<textarea name="warnings" rows={2} defaultValue={editingProduct?.warnings ?? ""}/></label>
                <label className="admin-check-label"><input name="is_featured" type="checkbox" defaultChecked={editingProduct?.is_featured ?? false}/> Feature on storefront</label>
                <button className="admin-primary" type="submit">{editingProduct ? "Save changes" : "Create product"}</button>
              </form>
            </div>
            <div className="admin-panel"><div className="admin-panel-head"><h2>Catalogue ({adminProducts.length})</h2></div>
              {adminProducts.map(product => <div className="admin-row admin-product-row" key={product.id}><div><strong>{product.name}</strong><small>{product.sku || "No SKU"} · {product.category} · {product.is_visible ? "Visible" : "Hidden"} · {product.is_active ? "For sale" : "Display only"}</small></div><b>{product.is_active ? money(Number(product.price)) : "Not for sale"}</b><button onClick={() => { setEditingProduct(product); window.scrollTo({top:0,behavior:"smooth"}); }}>Edit</button><button className="admin-danger" onClick={() => void setAdminProductVisibility(product.id, product.is_visible !== false)}>{product.is_visible === false ? "Show" : "Hide"}</button></div>)}
            </div>
          </div>}
          {adminTab === "orders" && <div className="admin-content"><div className="admin-panel"><div className="admin-panel-head"><h2>Orders ({adminOrders.length})</h2></div>
            {adminOrders.map(order => <article className="admin-order-card" key={order.id}><div className="admin-order-head"><div><strong>{order.order_number || order.id.slice(0,8)}</strong><small>{order.full_name} · {order.phone} · {order.city}</small><small>{order.address}</small></div><b>{money(Number(order.total))}</b></div>
              <div className="admin-order-lines">{(order.order_items ?? []).map((item,i) => <span key={i}>{item.product_name} × {item.quantity} <b>{money(Number(item.line_total))}</b></span>)}</div>
              <div className="admin-order-controls"><label>Order status<select value={order.status} disabled={order.status === "cancelled"} onChange={e => void updateAdminOrder(order.id,"status",e.target.value)}>{["pending","confirmed","shipped","delivered","cancelled"].map(s => <option key={s}>{s}</option>)}</select></label><label>Payment status<select value={order.payment_status} onChange={e => void updateAdminOrder(order.id,"payment_status",e.target.value)}>{["pending","awaiting_confirmation","paid","failed","refunded"].map(s => <option key={s}>{s}</option>)}</select></label><label>Shipping fee (EGP)<input type="number" min="0" step="0.01" defaultValue={order.shipping_fee ?? 0} onBlur={e => { if (Number(e.target.value) !== Number(order.shipping_fee ?? 0)) void updateAdminShipping(order.id,e.target.value); }}/></label><label>Tracking number<input defaultValue={order.tracking_number ?? ""} placeholder="Courier tracking ID" onBlur={e => { if (e.target.value !== (order.tracking_number ?? "")) void updateAdminOrder(order.id,"tracking_number",e.target.value); }}/></label><label>InstaPay reference<input defaultValue={order.payment_reference ?? ""} placeholder="Transfer reference" onBlur={e => { if (e.target.value !== (order.payment_reference ?? "")) void updateAdminOrder(order.id,"payment_reference",e.target.value); }}/></label><span>{order.payment_method.toUpperCase()} · {new Date(order.created_at).toLocaleString()}</span></div>
            </article>)}
            {!adminOrders.length && <p className="admin-empty">No orders have been placed yet.</p>}
          </div></div>}
          {adminTab === "customers" && <div className="admin-content"><div className="admin-panel"><div className="admin-panel-head"><h2>Customer profiles ({adminCustomers.length})</h2></div>
            {adminCustomers.map(customer => <div className="admin-row" key={customer.id}><div><strong>{customer.full_name || "Customer"}</strong><small>{customer.email || "No email"} · {customer.phone || "No phone"}</small><small>{customer.city || "No city"}</small><small>{customer.address || "No saved address"}</small></div><small>Joined {new Date(customer.created_at).toLocaleDateString()}</small></div>)}
            {!adminCustomers.length && <p className="admin-empty">No customer profiles yet.</p>}
          </div></div>}

          {adminTab === "discounts" && <div className="admin-content admin-products-layout">
            <div className="admin-panel admin-editor"><div className="admin-panel-head"><h2>{editingCoupon ? "Edit promotion" : "Create promotion"}</h2>{editingCoupon && <button type="button" onClick={() => setEditingCoupon(null)}>New code</button>}</div>
              <form className="admin-product-form" key={editingCoupon?.id ?? "new-coupon"} onSubmit={saveAdminCoupon}>
                <input type="hidden" name="id" value={editingCoupon?.id ?? ""}/>
                <label>Discount code<input name="code" required maxLength={32} defaultValue={editingCoupon?.code ?? ""} placeholder="WELCOME10"/></label>
                <label>Customer-facing description<input name="description" defaultValue={editingCoupon?.description ?? ""} placeholder="A little welcome gift"/></label>
                <div className="admin-form-grid"><label>Discount type<select name="discount_type" defaultValue={editingCoupon?.discount_type ?? "percentage"}><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (EGP)</option></select></label><label>Value<input name="discount_value" type="number" min="0.01" step="0.01" required defaultValue={editingCoupon?.discount_value ?? ""}/></label></div>
                <div className="admin-form-grid"><label>Minimum basket (EGP)<input name="minimum_order" type="number" min="0" step="0.01" defaultValue={editingCoupon?.minimum_order ?? 0}/></label><label>Maximum discount (EGP)<input name="maximum_discount" type="number" min="0.01" step="0.01" defaultValue={editingCoupon?.maximum_discount ?? ""}/></label></div>
                <label>Total uses allowed (blank = unlimited)<input name="usage_limit" type="number" min="1" step="1" defaultValue={editingCoupon?.usage_limit ?? ""}/></label>
                <div className="admin-form-grid"><label>Starts at<input name="starts_at" type="datetime-local" defaultValue={toLocalDateTime(editingCoupon?.starts_at)}/></label><label>Ends at<input name="ends_at" type="datetime-local" defaultValue={toLocalDateTime(editingCoupon?.ends_at)}/></label></div>
                <label className="admin-check-label"><input name="is_active" type="checkbox" defaultChecked={editingCoupon?.is_active ?? true}/> Promotion active</label>
                <button className="admin-primary" type="submit">{editingCoupon ? "Save promotion" : "Create promotion"}</button>
              </form>
              <p className="admin-help">Promotions only work inside their scheduled dates. The database checks the code again at checkout and enforces its usage limit.</p>
            </div>
            <div className="admin-panel"><div className="admin-panel-head"><h2>Promotions ({adminCoupons.length})</h2></div>
              {adminCoupons.map(coupon => <article className="admin-promo-card" key={coupon.id}><div className="admin-promo-head"><div><strong>{coupon.code}</strong><small>{coupon.description || "No description"}</small></div><span className={coupon.is_active ? "status-pill status-delivered" : "status-pill"}>{coupon.is_active ? "Active" : "Paused"}</span></div><p>{coupon.discount_type === "percentage" ? String(coupon.discount_value)+"% off" : money(Number(coupon.discount_value))+" off"} · Min. {money(Number(coupon.minimum_order))}</p><small>{coupon.starts_at ? new Date(coupon.starts_at).toLocaleString() : "Immediately"} → {coupon.ends_at ? new Date(coupon.ends_at).toLocaleString() : "No end date"}</small><div className="admin-promo-actions"><span>{coupon.used_count} used{coupon.usage_limit ? " / "+coupon.usage_limit : ""}</span><button onClick={() => setEditingCoupon(coupon)}>Edit</button><button onClick={() => void toggleCoupon(coupon)}>{coupon.is_active ? "Pause" : "Activate"}</button></div></article>)}
              {!adminCoupons.length && <p className="admin-empty">No promotions yet. Create your first launch offer.</p>}
            </div>
          </div>}
          {adminTab === "categories" && <div className="admin-content admin-products-layout">
            <div className="admin-panel admin-editor"><div className="admin-panel-head"><h2>{editingCategory ? "Edit category" : "Add category"}</h2>{editingCategory && <button onClick={() => setEditingCategory(null)}>Cancel</button>}</div>
              <form className="admin-product-form" key={editingCategory?.id ?? "new-category"} onSubmit={saveAdminCategory}>
                <input type="hidden" name="id" value={editingCategory?.id ?? ""}/>
                <label>Category name<input name="name" required defaultValue={editingCategory?.name ?? ""}/></label>
                <label>URL slug<input name="slug" defaultValue={editingCategory?.slug ?? ""} placeholder="auto-generated"/></label>
                <label>Description<textarea name="description" rows={3} defaultValue={editingCategory?.description ?? ""}/></label>
                <label>Display order<input name="sort_order" type="number" step="1" defaultValue={editingCategory?.sort_order ?? 0}/></label>
                <button className="admin-primary" type="submit">{editingCategory ? "Save category" : "Add category"}</button>
              </form>
            </div>
            <div className="admin-panel"><div className="admin-panel-head"><h2>Store categories ({adminCategories.length})</h2></div>
              {adminCategories.map(item => <div className="admin-row admin-product-row" key={item.id}><div><strong>{item.name}</strong><small>{item.slug} · {item.is_active ? "Visible" : "Hidden"}</small></div><button onClick={() => setEditingCategory(item)}>Edit</button><button onClick={() => void toggleCategory(item)}>{item.is_active ? "Hide" : "Restore"}</button></div>)}
              {!adminCategories.length && <p className="admin-empty">Add categories to organise your catalogue.</p>}
            </div>
          </div>}
          {adminTab === "content" && <div className="admin-content"><div className="admin-panel"><div className="admin-panel-head"><h2>Website content manager</h2><span className="status-pill">Live database content</span></div><p className="admin-help">Edit the text in both languages. Changes are saved to Supabase and synced to open storefronts. Upload image files directly from this computer.</p><form className="admin-settings-form" onSubmit={saveSiteContent}><h3>Hero section</h3><label>Announcement (EN)<input name="announcement_en" defaultValue={siteContent.announcement?.en ?? ""}/></label><label>Announcement (AR)<input name="announcement_ar" dir="rtl" defaultValue={siteContent.announcement?.ar ?? ""}/></label><div className="admin-form-grid"><label>Eyebrow (EN)<input name="hero_eyebrow_en" defaultValue={siteContent.hero_eyebrow?.en ?? "FUEL YOUR POTENTIAL"}/></label><label>Eyebrow (AR)<input name="hero_eyebrow_ar" dir="rtl" defaultValue={siteContent.hero_eyebrow?.ar ?? "أطلق إمكاناتك"}/></label><label>Headline line 1 (EN)<input name="hero_title_en" defaultValue={siteContent.hero_title?.en ?? "HIGH PROTEIN"}/></label><label>Headline line 1 (AR)<input name="hero_title_ar" dir="rtl" defaultValue={siteContent.hero_title?.ar ?? "بروتين عالي"}/></label><label>Headline line 2 (EN)<input name="hero_line_two_en" defaultValue={siteContent.hero_line_two?.en ?? "+ CREATINE"}/></label><label>Headline line 2 (AR)<input name="hero_line_two_ar" dir="rtl" defaultValue={siteContent.hero_line_two?.ar ?? "+ كرياتين"}/></label></div><label>Supporting text (EN)<textarea name="hero_subtitle_en" rows={2} defaultValue={siteContent.hero_subtitle?.en ?? "Build Muscle. Recover Faster. Perform Stronger."}/></label><label>Supporting text (AR)<textarea name="hero_subtitle_ar" rows={2} dir="rtl" defaultValue={siteContent.hero_subtitle?.ar ?? "ابنِ العضلات. تعافَ أسرع. أدِّ بشكل أقوى."}/></label><div className="admin-form-grid"><label>Main button (EN)<input name="hero_cta_en" defaultValue={siteContent.hero_cta?.en ?? "SHOP NOW"}/></label><label>Main button (AR)<input name="hero_cta_ar" dir="rtl" defaultValue={siteContent.hero_cta?.ar ?? "تسوق الآن"}/></label></div><label>Upload hero product image<input name="hero_photo_file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"/></label>{siteContent.hero_photo?.image_url && <div className="admin-image-preview"><img src={siteContent.hero_photo.image_url} alt="Current hero"/><small>Current hero image. Upload a replacement above.</small></div>}<h3>Product shelves</h3><div className="admin-form-grid"><label>Section title (EN)<input name="shelves_title_en" defaultValue={siteContent.shelves_title?.en ?? "THE ARSENAL"}/></label><label>Section title (AR)<input name="shelves_title_ar" dir="rtl" defaultValue={siteContent.shelves_title?.ar ?? "المنتجات"}/></label></div><label>Section description (EN)<textarea name="shelves_subtitle_en" rows={2} defaultValue={siteContent.shelves_subtitle?.en ?? "Choose the right formula for your training."}/></label><label>Section description (AR)<textarea name="shelves_subtitle_ar" rows={2} dir="rtl" defaultValue={siteContent.shelves_subtitle?.ar ?? "اختر التركيبة المناسبة لتدريبك."}/></label><h3>Store promises</h3>{[1,2,3].map(n=><div className="admin-form-grid" key={n}><label>Promise {n} title (EN)<input name={`promise_${n}_title_en`} defaultValue={siteContent[`promise_${n}_title`]?.en ?? ""}/></label><label>Promise {n} title (AR)<input name={`promise_${n}_title_ar`} dir="rtl" defaultValue={siteContent[`promise_${n}_title`]?.ar ?? ""}/></label><label>Promise {n} description (EN)<input name={`promise_${n}_body_en`} defaultValue={siteContent[`promise_${n}_body`]?.en ?? ""}/></label><label>Promise {n} description (AR)<input name={`promise_${n}_body_ar`} dir="rtl" defaultValue={siteContent[`promise_${n}_body`]?.ar ?? ""}/></label></div>)}<h3>About, journal and footer</h3><div className="admin-form-grid"><label>About title (EN)<input name="about_title_en" defaultValue={siteContent.about_title?.en ?? "Progress is built in the details."}/></label><label>About title (AR)<input name="about_title_ar" dir="rtl" defaultValue={siteContent.about_title?.ar ?? "التقدم يبدأ من التفاصيل"}/></label></div><label>About paragraph (EN)<textarea name="about_body_en" rows={3} defaultValue={siteContent.about_body?.en ?? ""}/></label><label>About paragraph (AR)<textarea name="about_body_ar" rows={3} dir="rtl" defaultValue={siteContent.about_body?.ar ?? ""}/></label><div className="admin-form-grid"><label>Journal title (EN)<input name="journal_title_en" defaultValue={siteContent.journal_title?.en ?? "Knowledge is part of the work."}/></label><label>Journal title (AR)<input name="journal_title_ar" dir="rtl" defaultValue={siteContent.journal_title?.ar ?? "المعرفة جزء من الرحلة"}/></label></div><label>Footer description (EN)<textarea name="footer_text_en" rows={2} defaultValue={siteContent.footer_text?.en ?? ""}/></label><label>Footer description (AR)<textarea name="footer_text_ar" rows={2} dir="rtl" defaultValue={siteContent.footer_text?.ar ?? ""}/></label><button className="admin-primary" type="submit">Save website content</button></form></div></div>}
          {adminTab === "settings" && <div className="admin-content"><div className="admin-panel"><div className="admin-panel-head"><h2>Store experience</h2><span className="status-pill">Live configuration</span></div>
            <form className="admin-settings-form" key={JSON.stringify(adminSettings)} onSubmit={saveStoreSettings}>
              <h3>Brand and customer support</h3><div className="admin-form-grid"><label>Store name<input name="store_name" defaultValue={adminSettings.store_profile?.store_name ?? "MUSASHI"}/></label><label>Support email<input name="support_email" type="email" defaultValue={adminSettings.store_profile?.support_email ?? ""}/></label><label>Support phone<input name="support_phone" defaultValue={adminSettings.store_profile?.support_phone ?? ""}/></label><label>WhatsApp number<input name="whatsapp_number" defaultValue={adminSettings.social?.whatsapp_number ?? ""}/></label></div>
              <h3>Delivery and checkout</h3><div className="admin-form-grid"><label>Standard delivery fee (EGP)<input name="standard_fee" type="number" min="0" step="0.01" defaultValue={adminSettings.shipping?.standard_fee ?? 60}/></label><label>Free delivery from (EGP)<input name="free_shipping_threshold" type="number" min="0" step="0.01" defaultValue={adminSettings.shipping?.free_shipping_threshold ?? 1500}/></label></div><label>Estimated delivery time<input name="estimated_delivery" defaultValue={adminSettings.shipping?.estimated_delivery ?? "2–5 business days"}/></label>
              <h3>Homepage content · English and Arabic</h3><label>Announcement bar<input name="announcement" defaultValue={adminSettings.homepage?.announcement ?? ""}/></label><div className="admin-form-grid"><label>Hero kicker (EN)<input name="hero_kicker" defaultValue={adminSettings.homepage?.kicker ?? "FUEL YOUR POTENTIAL"}/></label><label>Hero kicker (AR)<input name="hero_kicker_ar" dir="rtl" defaultValue={adminSettings.homepage?.kicker_ar ?? "أطلق إمكاناتك"}/></label><label>Hero first line (EN)<input name="hero_line_one" defaultValue={adminSettings.homepage?.hero_line_one ?? "HIGH PROTEIN"}/></label><label>Hero first line (AR)<input name="hero_line_one_ar" dir="rtl" defaultValue={adminSettings.homepage?.hero_line_one_ar ?? "بروتين عالي"}/></label><label>Hero second line (EN)<input name="hero_line_two" defaultValue={adminSettings.homepage?.hero_line_two ?? "+ CREATINE"}/></label><label>Hero second line (AR)<input name="hero_line_two_ar" dir="rtl" defaultValue={adminSettings.homepage?.hero_line_two_ar ?? "+ كرياتين"}/></label></div><label>Hero supporting text (EN)<textarea name="hero_subtitle" rows={2} defaultValue={adminSettings.homepage?.hero_subtitle ?? "Build Muscle. Recover Faster. Perform Stronger."}/></label><label>Hero supporting text (AR)<textarea name="hero_subtitle_ar" rows={2} dir="rtl" defaultValue={adminSettings.homepage?.hero_subtitle_ar ?? "ابنِ العضلات. تعافَ أسرع. أدِّ بشكل أقوى."}/></label><label>Upload hero product image from your computer<input name="hero_image" type="file" accept="image/jpeg,image/png,image/webp,image/avif"/></label>{adminSettings.homepage?.hero_image_url && <div className="admin-image-preview"><img src={adminSettings.homepage.hero_image_url} alt="Current hero"/> <small>Current hero image</small></div>}
              <h3>Other homepage sections · English and Arabic</h3><div className="admin-form-grid"><label>Strength section title (EN)<input name="strength_title" defaultValue={adminSettings.homepage?.strength_title ?? "Train with intent."}/></label><label>Strength section title (AR)<input name="strength_title_ar" dir="rtl" defaultValue={adminSettings.homepage?.strength_title_ar ?? "تدرّب بهدف واضح"}/></label><label>Strength supporting text (EN)<input name="strength_subtitle" defaultValue={adminSettings.homepage?.strength_subtitle ?? "Simple principles. Stronger habits. Better sessions."}/></label><label>Strength supporting text (AR)<input name="strength_subtitle_ar" dir="rtl" defaultValue={adminSettings.homepage?.strength_subtitle_ar ?? "مبادئ بسيطة. عادات أقوى. تدريبات أفضل."}/></label><label>About headline (EN)<input name="manifesto_title" defaultValue={adminSettings.homepage?.manifesto_title ?? "Progress is built in the details."}/></label><label>About headline (AR)<input name="manifesto_title_ar" dir="rtl" defaultValue={adminSettings.homepage?.manifesto_title_ar ?? "التقدم يبدأ من التفاصيل"}/></label></div><label>About paragraph (EN)<textarea name="manifesto_body" rows={3} defaultValue={adminSettings.homepage?.manifesto_body ?? "We believe the best performance routine is the one you can trust. Clear formulas, considered sourcing, and products that make sense in the real world."}/></label><label>About paragraph (AR)<textarea name="manifesto_body_ar" rows={3} dir="rtl" defaultValue={adminSettings.homepage?.manifesto_body_ar ?? "نؤمن بأن أفضل روتين للأداء هو ما يمكنك الوثوق به. تركيبات واضحة ومصادر موثوقة ومنتجات تناسب احتياجاتك."}/></label><div className="admin-form-grid"><label>Journal title (EN)<input name="journal_title" defaultValue={adminSettings.homepage?.journal_title ?? "Knowledge is part of the work."}/></label><label>Journal title (AR)<input name="journal_title_ar" dir="rtl" defaultValue={adminSettings.homepage?.journal_title_ar ?? "المعرفة جزء من الرحلة"}/></label><label>Closing CTA (EN)<input name="closing_title" defaultValue={adminSettings.homepage?.closing_title ?? "Show up. Every day."}/></label><label>Closing CTA (AR)<input name="closing_title_ar" dir="rtl" defaultValue={adminSettings.homepage?.closing_title_ar ?? "كن حاضرًا. كل يوم."}/></label></div>
              <h3>Social links</h3><div className="admin-form-grid"><label>Instagram URL<input name="instagram_url" type="url" defaultValue={adminSettings.social?.instagram_url ?? ""}/></label><label>Facebook URL<input name="facebook_url" type="url" defaultValue={adminSettings.social?.facebook_url ?? ""}/></label></div>
                            <h3>InstaPay configuration</h3><div className="admin-form-grid"><label>InstaPay alias / registered number<input name="instapay_alias" defaultValue={adminSettings.payments?.instapay_alias ?? ""} placeholder="Enter the official receiving alias"/></label><label>Account holder name<input name="instapay_account_name" defaultValue={adminSettings.payments?.account_name ?? ""}/></label></div><label>Customer transfer instructions<textarea name="instapay_instructions" rows={3} defaultValue={adminSettings.payments?.instructions ?? ""}/></label><h3>Seller details and customer policies</h3><div className="admin-form-grid"><label>Registered business / legal name<input name="legal_name" defaultValue={adminSettings.legal?.legal_name ?? ""}/></label><label>Commercial registration number<input name="commercial_register" defaultValue={adminSettings.legal?.commercial_register ?? ""}/></label><label>Tax registration number<input name="tax_number" defaultValue={adminSettings.legal?.tax_number ?? ""}/></label><label>Business address<input name="business_address" defaultValue={adminSettings.legal?.business_address ?? ""}/></label></div><label>Returns and exchanges policy<textarea name="return_policy" rows={4} defaultValue={adminSettings.legal?.return_policy ?? ""} placeholder="Set out your accurate return, exchange and damaged-product process."/></label><label>Shipping and delivery policy<textarea name="shipping_policy" rows={4} defaultValue={adminSettings.legal?.shipping_policy ?? ""} placeholder="Coverage areas, delivery estimates, fees and failed-delivery process."/></label><label>Privacy policy<textarea name="privacy_policy" rows={5} defaultValue={adminSettings.legal?.privacy_policy ?? ""} placeholder="Explain what customer data you collect, why, how long it is kept and how customers can contact you."/></label><label>Terms and conditions<textarea name="terms_conditions" rows={5} defaultValue={adminSettings.legal?.terms_conditions ?? ""} placeholder="Order acceptance, pricing, payment, product information, liability and disputes."/></label>
              <button className="admin-primary" type="submit">Save all store settings</button>
            </form>
          </div></div>}
          {adminTab === "inventory" && <div className="admin-content"><div className="admin-stat-grid"><article><span>TOTAL UNITS</span><strong>{adminProducts.reduce((s,p) => s + Number(p.stock || 0),0)}</strong></article><article><span>LOW STOCK ITEMS</span><strong>{adminProducts.filter(p => p.stock <= (p.reorder_level ?? 5)).length}</strong></article><article><span>RECORDED MOVEMENTS</span><strong>{adminInventory.length}</strong></article></div><div className="admin-panel"><div className="admin-panel-head"><h2>Current stock levels</h2><span className="inventory-legend">LIVE DATABASE QUANTITIES</span></div>
            <div className="inventory-level-list">{adminProducts.filter(p=>p.is_visible !== false).map(product=>{const stock=Number(product.stock||0),threshold=Number(product.reorder_level??5),percent=threshold>0?Math.min(100,stock/Math.max(threshold*3,1)*100):100;return <article className="inventory-level-row" key={product.id}><div className="inventory-product-name"><strong>{product.name}</strong><small>{product.sku || product.category}</small></div><div className="inventory-meter"><span style={{width:percent+"%"}} className={stock<=threshold?"is-low":""}/></div><strong className={stock<=threshold?"inventory-low":""}>{stock} <small>units</small></strong><span className={stock===0?"inventory-status-out":stock<=threshold?"inventory-status-low":"inventory-status-ok"}>{stock===0?"OUT OF STOCK":stock<=threshold?"LOW STOCK":"IN STOCK"}</span></article>})}</div>
            <div className="admin-panel-head inventory-history-heading"><h2>Stock movement history</h2></div>
            {adminInventory.map(move => <div className="admin-row" key={move.id}><div><strong>{move.products?.name || "Product"}</strong><small>{move.reason || move.movement_type} · {new Date(move.created_at).toLocaleString()}</small></div><span>{move.movement_type}</span><b className={move.quantity_change < 0 ? "admin-negative" : "admin-positive"}>{move.quantity_change > 0 ? "+" : ""}{move.quantity_change}</b><small>{move.stock_before} → {move.stock_after}</small></div>)}
            {!adminInventory.length && <p className="admin-empty">Inventory changes will be recorded here automatically.</p>}
          </div></div>}
        </section>
      </div>}
      {notice && <div className="toast" role="status"><Check size={16}/>{notice}<button onClick={() => setNotice("")}><X size={14}/></button></div>}
      {!isSupabaseConfigured && <div className="setup-hint">PREVIEW MODE · Add your Supabase keys in <code>.env</code> to activate accounts and live products.</div>}
    </>
  );
}

export default App;