import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Menu, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

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
  is_showcase?: boolean;
};

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

const fallbackProducts: Product[] = [
  { id: "whey", name: "Gold Standard Whey", category: "PROTEIN", description: "A daily essential. Smooth texture, considered nutrition.", price: 1500, stock: 50, image_url: null },
  { id: "creatine", name: "Musashi Fuel Creatine Monohydrate", category: "PERFORMANCE", description: "Unflavoured creatine monohydrate. Product preview only — final price and stock will be confirmed before launch.", price: 0, stock: 0, brand: "Musashi", size_label: "350 g", servings: 70, image_url: null, is_showcase: true },
  { id: "pre", name: "Pre-Workout", category: "ENERGY", description: "A focused formula for the work ahead.", price: 750, stock: 40, image_url: null },
];

const money = (value: number) => new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(value);
const toLocalDateTime = (value?: string | null) => { if (!value) return ""; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset()*60000).toISOString().slice(0,16); };

function App() {
  const heroRef = useRef<HTMLElement>(null);
  const bottleRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const powderRef = useRef<HTMLDivElement>(null);
  const productStageRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<Product[]>(isSupabaseConfigured ? [] : fallbackProducts);
  const [cart, setCart] = useState<Record<string, number>>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("forme-cart") || "{}");
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
      return Object.fromEntries(Object.entries(saved).filter(([key,value]) => typeof key === "string" && Number.isInteger(value) && Number(value) > 0 && Number(value) <= 50)) as Record<string, number>;
    } catch { return {}; }
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
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
  const [adminTab, setAdminTab] = useState<"overview" | "products" | "orders" | "customers" | "inventory" | "discounts" | "categories" | "settings">("overview");
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
  const [paymentMethod, setPaymentMethod] = useState("cod");
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
    if (!supabase) return;
    const client = supabase;
    let active = true;
    client.from("products").select("id,name,category,description,price,compare_at_price,stock,image_url,brand,size_label,servings,ingredients,directions,warnings").eq("is_active", true).order("created_at")
      .then(({ data, error }) => {
        if (!active) return;
        if (!error) setProducts((data?.length ? data : fallbackProducts.map(item => ({...item, price: 0, stock: 0, image_url: null, is_showcase: true }))) as Product[]);
        else setNotice("The product catalogue could not be loaded. Please try again shortly.");
      });
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
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro.from(".nav-inner", { y: -24, opacity: 0, duration: 0.8 })
        .from(".musashi-wrap", { y: -260, rotate: -9, opacity: 0, duration: 1.05, ease: "bounce.out" }, "-=0.25")
        .from(".hero-copy > *", { y: 28, opacity: 0, duration: 0.75, stagger: 0.1 }, "-=0.35")
        .from(".hero-visual", { scale: 0.88, opacity: 0, duration: 1.1 }, "-=0.8");

      if (bottleRef.current && capRef.current && powderRef.current && productStageRef.current) {
        const story = gsap.timeline({
          scrollTrigger: {
            trigger: heroRef.current,
            start: "top top",
            end: "+=100%",
            scrub: 0.65,
            pin: true,
            anticipatePin: 1,
          },
        });
        story.to(".hero-copy", { yPercent: -18, opacity: 0.12, duration: 0.42 }, 0)
          .to(capRef.current, { y: -72, x: -34, rotate: -72, scale: 0.94, duration: 0.34, ease: "power2.in" }, 0.12)
          .to(bottleRef.current, { rotate: -19, x: -22, y: 24, duration: 0.48, ease: "power2.inOut" }, 0.28)
          .to(powderRef.current, { opacity: 1, scale: 1, x: 38, y: 42, duration: 0.36, ease: "power2.out" }, 0.43)
          .to(".powder-pour", { opacity: 0.92, scaleY: 1.12, duration: 0.34, ease: "power2.out" }, 0.47)
          .to(".powder-grain", { y: 155, x: "random(-125, 125)", rotation: "random(-180, 180)", opacity: 0, stagger: 0.006, duration: 0.58, ease: "power1.in" }, 0.52)
          .to(productStageRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.2)" }, 0.68)
          .to(".stage-product", { y: 0, rotate: 0, opacity: 1, stagger: 0.08, duration: 0.45, ease: "back.out(1.5)" }, 0.7);
      }

      gsap.utils.toArray<HTMLElement>(".reveal").forEach((element) => {
        gsap.from(element, {
          y: 36, opacity: 0, duration: 0.8, ease: "power3.out",
          scrollTrigger: { trigger: element, start: "top 88%", once: true },
        });
      });
      gsap.to(".ticker-track", { xPercent: -25, duration: 24, repeat: -1, ease: "none" });
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
    if (!result?.valid) { setCouponDiscount(0); setCouponMessage(result?.message || "This code is not available."); return; }
    setCouponDiscount(Number(result.discount_amount || 0));
    setCouponMessage(result.message || "Discount applied.");
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

  async function saveStoreSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    const form = new FormData(event.currentTarget);
    const records = [
      { setting_key: "store_profile", setting_value: { store_name: String(form.get("store_name") || "FORME").trim(), support_email: String(form.get("support_email") || "").trim(), support_phone: String(form.get("support_phone") || "").trim(), currency: "EGP", country: "Egypt" }, description: "Public store identity and contact details" },
      { setting_key: "shipping", setting_value: { standard_fee: Number(form.get("standard_fee") || 0), free_shipping_threshold: Number(form.get("free_shipping_threshold") || 0), estimated_delivery: String(form.get("estimated_delivery") || "").trim() }, description: "Checkout delivery pricing and estimate" },
      { setting_key: "homepage", setting_value: { announcement: String(form.get("announcement") || "").trim(), hero_title: String(form.get("hero_title") || "").trim(), hero_subtitle: String(form.get("hero_subtitle") || "").trim() }, description: "Homepage copy and announcement bar" },
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
      name, slug,
      sku: String(form.get("sku") ?? "").trim() || null,
      brand: String(form.get("brand") ?? "").trim() || null,
      size_label: String(form.get("size_label") ?? "").trim() || null,
      category: String(form.get("category") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      price: Number(form.get("price")),
      cost_price: form.get("cost_price") ? Number(form.get("cost_price")) : null,
      compare_at_price: form.get("compare_at_price") ? Number(form.get("compare_at_price")) : null,
      stock: Number(form.get("stock")),
      reorder_level: Number(form.get("reorder_level") || 5),
      servings: form.get("servings") ? Number(form.get("servings")) : null,
      ingredients: String(form.get("ingredients") ?? "").trim() || null,
      directions: String(form.get("directions") ?? "").trim() || null,
      warnings: String(form.get("warnings") ?? "").trim() || null,
      is_featured: form.get("is_featured") === "on",
      image_url: String(form.get("image_url") ?? "").trim() || null,
      is_active: true,
    };
    if (!name || !payload.category || !Number.isFinite(payload.price) || payload.price < 0 || !Number.isInteger(payload.stock) || payload.stock < 0) {
      setNotice("Check the product name, category, price and stock values.");
      return;
    }
    const result = editingProduct
      ? await supabase.from("products").update(payload).eq("id", editingProduct.id)
      : await supabase.from("products").insert(payload);
    if (result.error) { setNotice(result.error.message); return; }
    setEditingProduct(null);
    formElement.reset();
    setNotice(editingProduct ? "Product updated." : "Product added.");
    await loadAdminData();
    const { data } = await supabase.from("products").select("id,name,category,description,price,compare_at_price,stock,image_url,brand,size_label,servings,ingredients,directions,warnings").eq("is_active", true).order("created_at");
    if (data) setProducts(data as Product[]);
  }

  async function setAdminProductActive(id: string, currentActive: boolean) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("products").update({ is_active: !currentActive }).eq("id", id);
    if (error) setNotice(error.message);
    else {
      setNotice(currentActive ? "Product hidden from the storefront." : "Product restored to the storefront.");
      await loadAdminData();
      const { data } = await supabase.from("products").select("id,name,category,description,price,compare_at_price,stock,image_url").eq("is_active", true).order("created_at");
      setProducts((data ?? []) as Product[]);
    }
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
  const visibleProducts = products.filter((product) => (category === "ALL" || product.category?.toUpperCase() === category) && (!searchQuery.trim() || (product.name+" "+(product.description ?? "")+" "+(product.category ?? "")).toLowerCase().includes(searchQuery.trim().toLowerCase())));
  const cartItems = products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] }));
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingSettings = adminSettings.shipping ?? { standard_fee: 60, free_shipping_threshold: 1500, estimated_delivery: "2–5 business days" };
  const estimatedShipping = cartTotal >= Number(shippingSettings.free_shipping_threshold ?? 1500) ? 0 : Number(shippingSettings.standard_fee ?? 60);
  const checkoutTotal = Math.max(0, cartTotal - couponDiscount + estimatedShipping);
  useEffect(() => { setCouponDiscount(0); setCouponMessage(""); }, [cart]);
  const addToCart = (id: string) => {
    const product = products.find((item) => item.id === id);
    if (product?.is_showcase) { setNotice("This product is being prepared. Check back soon."); return; }
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
    if (!supabase) { setNotice("Connect Supabase to place an order."); return; }
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) { setCheckoutOpen(false); setAuthMode("login"); setAuthOpen(true); setNotice("Please sign in before checkout."); return; }
    const form = new FormData(event.currentTarget);
    const payload = {
      p_items: cartItems.map((item) => ({ product_id: item.id, quantity: item.quantity })),
      p_full_name: String(form.get("full_name") ?? ""),
      p_phone: String(form.get("phone") ?? ""),
      p_address: String(form.get("address") ?? ""),
      p_city: String(form.get("city") ?? ""),
      p_payment_method: String(form.get("payment_method") ?? "cod"),
      p_notes: String(form.get("notes") ?? ""),
    };
    const { data, error } = await supabase.rpc("place_order", { ...payload, p_coupon_code: couponDiscount > 0 ? couponCode.trim() : null });
    if (error) { setNotice(error.message); return; }
    const { data: placedOrder } = await supabase.from("orders").select("order_number,total,subtotal,shipping_fee,discount_total").eq("id", data).maybeSingle();
    setCart({});
    setCouponCode(""); setCouponDiscount(0); setCouponMessage("");
    setCheckoutOpen(false);
    setOrderConfirmation({
      order_number: placedOrder?.order_number ?? String(data).slice(0,8),
      total: Number(placedOrder?.total ?? checkoutTotal),
      subtotal: Number(placedOrder?.subtotal ?? cartTotal),
      shipping_fee: Number(placedOrder?.shipping_fee ?? estimatedShipping),
      discount_total: Number(placedOrder?.discount_total ?? couponDiscount),
      payment_method: String(form.get("payment_method") ?? "cod"),
      full_name: String(form.get("full_name") ?? ""),
      phone: String(form.get("phone") ?? ""),
      city: String(form.get("city") ?? ""),
      address: String(form.get("address") ?? ""),
      items: cartItems.map(item=>({name:item.name,quantity:item.quantity,unit_price:Number(item.price),line_total:Number(item.price)*item.quantity}))
    });
    setNotice("Your order has been received. We’ll contact you to confirm delivery.");
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
      ? await supabase.auth.signUp({ email, password })
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
          <a className="wordmark" href="#top">{adminSettings.store_profile?.store_name || "FORME"}<span>®</span></a>
          <nav className={menuOpen ? "main-nav is-open" : "main-nav"}>
            <a href="#shop" onClick={() => setMenuOpen(false)}>Shop</a>
            <a href="#philosophy" onClick={() => setMenuOpen(false)}>Our standard</a>
            <a href="#journal" onClick={() => setMenuOpen(false)}>Journal</a>
          </nav>
          <div className="nav-actions">
            {isAdmin && <button className="text-button admin-nav-button" onClick={() => { setAdminOpen(true); setAdminTab("overview"); void loadAdminData(); }}>ADMIN</button>}
            <button className="text-button account-button" onClick={() => { if (userEmail) void loadMyOrders(); else { setAuthMode("login"); setAuthOpen(true); } }}>{userEmail ? "My account" : "Account"}</button>
            <button className="bag-button" aria-label="Open cart" onClick={() => setCartOpen(true)}><ShoppingBag size={17}/><span>Bag ({Object.values(cart).reduce((a,b) => a+b, 0)})</span></button>
            <button className="menu-button" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero" ref={heroRef}>
          
          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow"><span className="eyebrow-line"/> PERFORMANCE, REFINED</p>
              <h1>{adminSettings.homepage?.hero_title || "BUILT FOR THE WORK."}</h1>
              <p className="hero-description">{adminSettings.homepage?.hero_subtitle || "Creatine. Consistency. No shortcuts. Performance nutrition for the work you put in every day."}</p>
              <div className="hero-links"><a className="button button-light" href="#shop">Explore the collection <ArrowUpRight size={16}/></a><span>BUILT FOR THE LONG RUN</span></div>
            </div>
            <div className="hero-visual">
              <div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
              <div className="hero-product-label"><span>01 / DAILY PERFORMANCE</span><span>CREATINE · 300 G</span></div>
              <div className="bottle-wrap musashi-wrap" ref={bottleRef}>
                <div className="bottle-cap" ref={capRef}><div className="cap-ridges"/></div>
                <div className="bottle musashi-bottle"><div className="bottle-neck"/><div className="bottle-label musashi-label"><span className="label-brand">MUSASHI</span><small className="musashi-fuel">FUEL</small><strong>CREATINE</strong><small>MONOHYDRATE 1G/G</small><div className="musashi-facts"><b>5G<small>PER SERVE</small></b><b>70<small>SERVES</small></b></div><span className="label-bottom">UNFLAVOURED · 350G ORAL POWDER</span></div></div>
              </div>
              <div className="powder-cloud" ref={powderRef}>
                {Array.from({length: 38}, (_, i) => <i className="powder-grain" key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 19) % 65}%`, width: `${3 + (i % 5)}px`, height: `${3 + (i % 5)}px` }}/>)}
                <div className="powder-pour"/>
              </div>
              <div className="stage-products" ref={productStageRef}>
                <div className="stage-product stage-one"><span>FORME / 02</span><strong>WHEY<br/>PROTEIN</strong><small>DAILY FUEL</small></div>
                <div className="stage-product stage-two"><span>FORME / 03</span><strong>ELECTRO-<br/>LYTES</strong><small>HYDRATION</small></div>
                <div className="stage-product stage-three"><span>FORME / 04</span><strong>PRE<br/>WORKOUT</strong><small>FOCUS + ENERGY</small></div>
              </div>
              <span className="scroll-cue"><ArrowDown size={14}/> SCROLL TO CRACK THE SEAL</span>
            </div>
          </div>
          <div className="hero-foot"><span>FORMULATED WITH INTENTION</span><span>CAIRO · EGYPT</span><span>01 — 04</span></div>
        </section>

        <div className="ticker"><div className="ticker-track">{Array.from({length: 8}, (_, i) => <span key={i}>DISCIPLINE IS A DAILY PRACTICE <b>✳</b> PERFORMANCE, WITHOUT COMPROMISE <b>✳</b></span>)}</div></div>

        <section className="shop-section section-pad" id="shop">
          <div className="section-heading reveal"><div><p className="eyebrow">THE COLLECTION / 001—006</p><h2>Essentials for<br/><em>what’s next.</em></h2></div><p>Thoughtful formulas. Transparent ingredients.<br/>Made to earn their place in your routine.</p></div>
          <div className="filter-row reveal"><div className="filters">{categories.map((item) => <button key={item} className={category === item ? "filter active" : "filter"} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="shop-search"><span>SEARCH</span><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Find your formula…"/></label><span>{visibleProducts.length.toString().padStart(2,"0")} PRODUCTS</span></div>
          <div className="product-grid gym-shelf-grid">
            {visibleProducts.map((product, index) => <article className="product-card reveal" key={product.id}>
              <div className={`product-art art-${index % 3}`}>
                <span className="product-index">0{index + 1} / FORME LABS</span>
                {product.image_url ? <img src={product.image_url} alt={product.name}/> : <div className="mini-tub"><span>FORME</span><strong>{product.name.toUpperCase()}</strong><small>{product.category?.toUpperCase()}</small></div>}
                <button className="quick-add" aria-label={product.is_showcase ? `View ${product.name}` : `Add ${product.name} to bag`} onClick={() => product.is_showcase ? setSelectedProduct(product) : addToCart(product.id)}><Plus size={18}/></button>
                <span className="stock-note">{product.is_showcase ? "COMING SOON" : product.stock > 0 ? "IN STOCK" : "SOLD OUT"}</span>
              </div>
              <div className="product-meta"><div><span>{product.category?.toUpperCase() ?? "FORME LABS"}</span><h3>{product.name}</h3></div><div className="product-pricing"><strong>{product.is_showcase ? "PRICE SOON" : money(product.price)}</strong>{product.compare_at_price && product.compare_at_price > product.price && <del>{money(Number(product.compare_at_price))}</del>}</div></div>
              <p className="product-description">{product.description}</p><button className="product-details-link" onClick={() => setSelectedProduct(product)}>Product details <ArrowUpRight size={13}/></button>
            </article>)}
          </div>
          {visibleProducts.length === 0 && <div className="catalog-empty"><span>FORME / THE COLLECTION</span><h3>{searchQuery ? "Nothing found this time." : "The first collection is being prepared."}</h3><p>{searchQuery ? "Try another product name or clear your search." : "We are preparing the product range. Check back shortly."}</p>{searchQuery && <button onClick={()=>setSearchQuery("")}>Clear search</button>}</div>}
        </section>

        <section className="trust-strip" aria-label="Store promises"><div><span>01</span><strong>Clear product information</strong><small>Know what you are choosing.</small></div><div><span>02</span><strong>Local delivery</strong><small>Egypt-wide delivery options.</small></div><div><span>03</span><strong>Human support</strong><small>Questions? We are here to help.</small></div><div><span>04</span><strong>Secure checkout</strong><small>Your order is recorded safely.</small></div></section>

        <section className="manifesto section-pad" id="philosophy">
          <div className="manifesto-mark reveal">F<span>®</span></div>
          <div className="manifesto-copy reveal"><p className="eyebrow">A BETTER KIND OF STANDARD</p><h2>Progress is built<br/>in the <em>details.</em></h2><p>We believe the best performance routine is the one you can trust. Clear formulas, considered sourcing, and products that make sense in the real world.</p><a href="#shop" className="underlined-link">Discover our approach <ArrowUpRight size={15}/></a></div>
          <div className="manifesto-side reveal"><span>01 — QUALITY</span><span>02 — CLARITY</span><span>03 — CONSISTENCY</span><span>04 — PROGRESS</span></div>
        </section>

        <section className="journal section-pad" id="journal">
          <div className="journal-head reveal"><p className="eyebrow">THE FORME JOURNAL</p><h2>Knowledge is<br/><em>part of the work.</em></h2><p>Useful thinking for a stronger everyday.</p></div>
          <div className="journal-cards">
            <article className="journal-card reveal"><span>01 / FOUNDATIONS</span><div className="journal-art journal-art-one">01</div><h3>The case for consistency.</h3><p>Why the small things compound.</p><a href="#shop">READ THE NOTE <ArrowUpRight size={14}/></a></article>
            <article className="journal-card reveal"><span>02 / PERFORMANCE</span><div className="journal-art journal-art-two">02</div><h3>Know what’s in your scoop.</h3><p>A clearer look at protein basics.</p><a href="#shop">READ THE NOTE <ArrowUpRight size={14}/></a></article>
            <article className="journal-card reveal"><span>03 / RECOVERY</span><div className="journal-art journal-art-three">03</div><h3>Rest is part of the plan.</h3><p>Training hard means recovering well.</p><a href="#shop">READ THE NOTE <ArrowUpRight size={14}/></a></article>
          </div>
        </section>

        <section className="faq-section section-pad" id="help"><div className="faq-intro"><p className="eyebrow">GOOD TO KNOW</p><h2>Questions,<br/><em>answered.</em></h2><p>Everything you need to shop with confidence.</p>{adminSettings.store_profile?.support_email && <a className="underlined-link" href={"mailto:"+adminSettings.store_profile.support_email}>Email support <ArrowUpRight size={15}/></a>}{adminSettings.social?.whatsapp_number && <a className="underlined-link" href={"https://wa.me/"+String(adminSettings.social.whatsapp_number).replace(/[^0-9]/g,"")} target="_blank" rel="noreferrer">Chat on WhatsApp <ArrowUpRight size={15}/></a>}</div><div className="faq-list"><details><summary>How do I choose the right supplement?<span>+</span></summary><p>Start with your training goal, read each product’s ingredients and serving information, and follow the label directions. Supplements are not a replacement for a balanced diet or professional medical advice.</p></details><details><summary>When will my order arrive?<span>+</span></summary><p>Our current estimated delivery window is {adminSettings.shipping?.estimated_delivery || "2–5 business days"}. We will contact you to confirm your order and delivery details.</p></details><details><summary>Which payment methods are available?<span>+</span></summary><p>Cash on delivery and InstaPay are currently supported. InstaPay transfers are checked manually before an order is marked as paid. Card payments will be added after a payment gateway is connected.</p></details><details><summary>Can I change or cancel an order?<span>+</span></summary><p>Contact our support team as soon as possible with your order reference. Changes depend on whether the order has already been prepared or dispatched.</p></details><details><summary>How do returns work?<span>+</span></summary><p>{adminSettings.legal?.return_policy || "Our returns policy is being finalised. Please contact support before placing an order."}</p></details>{adminSettings.legal?.shipping_policy && <details><summary>Shipping policy<span>+</span></summary><p>{adminSettings.legal.shipping_policy}</p></details>}{adminSettings.legal?.privacy_policy && <details><summary>Privacy policy<span>+</span></summary><p>{adminSettings.legal.privacy_policy}</p></details>}{adminSettings.legal?.terms_conditions && <details><summary>Terms and conditions<span>+</span></summary><p>{adminSettings.legal.terms_conditions}</p></details>}</div></section>

        <section className="closing-cta"><p className="eyebrow">THE NEXT REP STARTS HERE</p><h2>Show up.<br/><em>Every day.</em></h2><a href="#shop" className="button button-light">Shop the collection <ArrowRight size={16}/></a></section>
      </main>

      <footer className="footer"><a className="wordmark" href="#top">{adminSettings.store_profile?.store_name || "FORME"}<span>®</span></a><span>PERFORMANCE, REFINED.</span><a href="#help">HELP & DELIVERY</a>{adminSettings.social?.instagram_url && <a href={adminSettings.social.instagram_url} target="_blank" rel="noreferrer">INSTAGRAM ↗</a>}<span>© 2026 FORME LABS</span><a href="#top">BACK TO TOP ↑</a></footer>

      {cartOpen && <div className="drawer-backdrop" onClick={() => setCartOpen(false)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">YOUR SELECTION</p><h2>The bag <span>({cartItems.length})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)}><X/></button></div>
        {cartItems.length === 0 ? <div className="empty-state"><ShoppingBag size={30}/><p>Your bag is waiting for something good.</p><button className="underlined-link" onClick={() => setCartOpen(false)}>Explore products <ArrowRight size={14}/></button></div> : <>
          <div className="drawer-items">{cartItems.map((item) => <div className="drawer-item" key={item.id}><div className="drawer-thumb">F.</div><div className="drawer-item-info"><strong>{item.name}</strong><span>{money(item.price)}</span><div className="quantity-control"><button onClick={() => changeQuantity(item.id, -1)}><Minus size={13}/></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)}><Plus size={13}/></button></div></div><strong>{money(item.price * item.quantity)}</strong></div>)}</div>
          <div className="drawer-total"><span>SUBTOTAL</span><strong>{money(cartTotal)}</strong></div><p className="checkout-note">Shipping and payment details are confirmed at checkout.</p><button className="button button-dark full-button" onClick={async () => { setCartOpen(false); const {data} = await supabase?.auth.getSession() ?? {data:{session:null}}; if (data.session) setCheckoutOpen(true); else { setAuthMode("login"); setAuthOpen(true); setNotice("Sign in or create an account to continue. Your bag is saved."); } }}>Continue to checkout <ArrowRight size={16}/></button>
        </>}</aside></div>}


      {myOrdersOpen && <div className="modal-backdrop" onClick={()=>setMyOrdersOpen(false)}><section className="auth-modal my-orders-modal" onClick={event=>event.stopPropagation()}><button className="icon-button modal-close" onClick={()=>setMyOrdersOpen(false)}><X/></button><p className="eyebrow">YOUR FORME ACCOUNT</p><h2>Your orders.</h2><p className="auth-sub">{userEmail}</p>{myOrdersLoading ? <p className="admin-loading">Loading your orders…</p> : myOrders.length ? <div className="my-orders-list">{myOrders.map(order=><article key={order.id}><div className="my-order-heading"><strong>{order.order_number || order.id.slice(0,8)}</strong><span className={"status-pill status-"+order.status}>{order.status === "pending" ? "Received" : order.status}</span></div><small>{new Date(order.created_at).toLocaleDateString()} · {order.payment_method.toUpperCase()}</small>{(order.order_items ?? []).map((item:any,i:number)=><p key={i}>{item.product_name} × {item.quantity}</p>)}<div className="my-order-foot"><b>{money(Number(order.total))}</b><span>{order.payment_status.replaceAll("_"," ")}</span></div>{order.tracking_number && <small>Tracking: {order.tracking_number}</small>}</article>)}</div> : <p className="admin-empty">You haven't placed an order yet. Your next step starts in the collection.</p>}<button className="switch-auth" onClick={async()=>{await supabase?.auth.signOut();setMyOrdersOpen(false);setNotice("You have signed out.");}}>Sign out</button></section></div>}
      {selectedProduct && <div className="modal-backdrop" onClick={() => setSelectedProduct(null)}><section className="product-detail-modal" onClick={event=>event.stopPropagation()}><button className="icon-button modal-close" onClick={()=>setSelectedProduct(null)}><X/></button><div className="product-detail-art">{selectedProduct.image_url ? <img src={selectedProduct.image_url} alt={selectedProduct.name}/> : <div className="mini-tub"><span>{adminSettings.store_profile?.store_name || "FORME"}</span><strong>{selectedProduct.name.toUpperCase()}</strong><small>{selectedProduct.category?.toUpperCase()}</small></div>}</div><div className="product-detail-copy"><p className="eyebrow">{selectedProduct.category?.toUpperCase()} / PRODUCT DETAILS</p><h2>{selectedProduct.name}</h2>{selectedProduct.brand && <p className="product-brand">{selectedProduct.brand}</p>}<p>{selectedProduct.description}</p><strong className="product-detail-price">{selectedProduct.is_showcase ? "PRICE TO BE CONFIRMED" : money(selectedProduct.price)}</strong>{selectedProduct.size_label && <div className="product-detail-fact"><span>SIZE</span><b>{selectedProduct.size_label}</b></div>}{selectedProduct.servings && <div className="product-detail-fact"><span>SERVINGS</span><b>{selectedProduct.servings}</b></div>}{selectedProduct.ingredients && <div className="product-detail-section"><strong>Ingredients</strong><p>{selectedProduct.ingredients}</p></div>}{selectedProduct.directions && <div className="product-detail-section"><strong>How to use</strong><p>{selectedProduct.directions}</p></div>}{selectedProduct.warnings && <div className="product-detail-section"><strong>Important information</strong><p>{selectedProduct.warnings}</p></div>}<button className="button button-dark full-button" disabled={selectedProduct.stock<=0} onClick={()=>{addToCart(selectedProduct.id);setSelectedProduct(null);}}>Add to bag <ArrowRight size={16}/></button></div></section></div>}
      {checkoutOpen && <div className="modal-backdrop" onClick={() => setCheckoutOpen(false)}><section className="auth-modal checkout-modal" onClick={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={() => setCheckoutOpen(false)}><X/></button><p className="eyebrow">SECURE CHECKOUT</p><h2>Almost yours.</h2><p className="auth-sub">Delivery details · Your order is confirmed after you submit this form.</p>
          <div className="coupon-entry"><div><label htmlFor="checkout-coupon">Discount code</label><div className="coupon-entry-row"><input id="checkout-coupon" value={couponCode} onChange={e => {setCouponCode(e.target.value.toUpperCase());setCouponDiscount(0);setCouponMessage("");}} placeholder="Enter your code"/><button type="button" onClick={() => void previewCoupon()}>Apply</button></div></div>{couponMessage && <small className={couponDiscount > 0 ? "coupon-success" : "coupon-error"}>{couponMessage}</small>}</div>
          <div className="checkout-summary"><span>Subtotal <b>{money(cartTotal)}</b></span><span>Delivery <b>{estimatedShipping===0 ? "FREE" : money(estimatedShipping)}</b></span>{couponDiscount>0 && <span>Discount <b>−{money(couponDiscount)}</b></span>}<strong>Total <b>{money(checkoutTotal)}</b></strong></div>
          <form onSubmit={handleCheckout}><label>Full name<input name="full_name" required minLength={2} placeholder="Your full name"/></label><label>Phone number<input name="phone" required minLength={7} placeholder="+20"/></label><label>City<input name="city" required placeholder="Cairo"/></label><label>Delivery address<input name="address" required minLength={5} placeholder="Street, building, apartment"/></label><label>Payment method<select name="payment_method" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="cod">Cash on delivery</option><option value="instapay" disabled={!adminSettings.payments?.instapay_alias}>InstaPay transfer {!adminSettings.payments?.instapay_alias ? "(not configured)" : "(manual confirmation)"}</option></select></label>{paymentMethod==="instapay" && adminSettings.payments?.instapay_alias && <div className="instapay-info"><span>TRANSFER TO</span><strong>{adminSettings.payments.instapay_alias}</strong>{adminSettings.payments.account_name && <small>{adminSettings.payments.account_name}</small>}<p>{adminSettings.payments.instructions || "Transfer the exact order total and keep your transfer reference for confirmation."}</p></div>}<label>Delivery notes (optional)<input name="notes" placeholder="Anything we should know?"/></label><button className="button button-dark full-button" type="submit">Place order <ArrowRight size={16}/></button></form></section></div>}

      {orderConfirmation && <div className="modal-backdrop"><section className="auth-modal order-success-modal"><div className="success-mark no-print"><Check size={28}/></div><p className="eyebrow">FORME / ORDER RECEIPT</p><h2 className="no-print">Your order is received.</h2><p className="auth-sub no-print">Your order has been saved. Our team will contact you to confirm delivery details.</p><div className="receipt-header"><strong>{adminSettings.legal?.legal_name || adminSettings.store_profile?.store_name || "FORME"}</strong><span>{adminSettings.legal?.business_address || "Seller address to be completed in store settings"}</span><span>CR: {adminSettings.legal?.commercial_register || "Add commercial registration"}</span><span>Tax: {adminSettings.legal?.tax_number || "Add tax registration"}</span><span>{adminSettings.store_profile?.support_email || ""} {adminSettings.store_profile?.support_phone || ""}</span></div><div className="order-reference"><span>ORDER / INVOICE REFERENCE</span><strong>{orderConfirmation.order_number || "Received"}</strong><small>{new Date().toLocaleString()}</small></div><div className="receipt-customer"><strong>Customer</strong><span>{orderConfirmation.full_name}</span><span>{orderConfirmation.phone}</span><span>{orderConfirmation.address}, {orderConfirmation.city}</span></div><div className="receipt-lines">{orderConfirmation.items.map((item,i)=><div key={i}><span>{item.name} × {item.quantity}</span><b>{money(item.line_total)}</b></div>)}</div><div className="receipt-totals"><span>Subtotal <b>{money(orderConfirmation.subtotal)}</b></span><span>Delivery <b>{orderConfirmation.shipping_fee===0?"FREE":money(orderConfirmation.shipping_fee)}</b></span>{orderConfirmation.discount_total>0&&<span>Discount <b>−{money(orderConfirmation.discount_total)}</b></span>}<strong>Total due <b>{money(orderConfirmation.total)}</b></strong><small>Payment: {orderConfirmation.payment_method.toUpperCase()} · Estimated delivery: {adminSettings.shipping?.estimated_delivery || "To be confirmed"}</small></div><p className="receipt-policy">{adminSettings.legal?.return_policy || "Please contact the store for return and exchange terms. Complete this policy in Store Settings before launch."}</p><div className="receipt-actions no-print"><button className="button button-dark" onClick={()=>window.print()}>Print receipt</button><button className="button button-light" onClick={() => setOrderConfirmation(null)}>Continue shopping <ArrowRight size={16}/></button></div></section></div>}
      {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><section className="auth-modal" onClick={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={() => setAuthOpen(false)}><X/></button><p className="eyebrow">WELCOME TO FORME</p><h2>{authMode === "login" ? "Good to see you." : "Start your standard."}</h2><p className="auth-sub">Your account keeps your orders and details in one place.</p><form onSubmit={handleAuth}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com"/></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={authMode === "signup" ? 8 : 6} required placeholder={authMode === "signup" ? "At least 8 characters" : "Your password"}/></label><button className="button button-dark full-button" type="submit">{authMode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16}/></button></form>{authMode === "login" && <button className="switch-auth" onClick={() => void sendPasswordReset()}>Forgot password? Send me a reset link</button>}<button className="switch-auth" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button></section></div>}



      {recoveryMode && <div className="modal-backdrop"><section className="auth-modal"><p className="eyebrow">ACCOUNT SECURITY</p><h2>Set a new password.</h2><p className="auth-sub">Choose a strong password with at least 8 characters. Avoid short or easily guessed passwords.</p><form onSubmit={handlePasswordRecovery}><label>New password<input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></label><label>Confirm new password<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required autoComplete="new-password"/></label><button className="button button-dark full-button" type="submit">Update password <ArrowRight size={16}/></button></form></section></div>}
      {adminOpen && isAdmin && <div className="admin-overlay">
        <aside className="admin-sidebar">
          <div className="admin-brand"><span className="admin-brand-mark">F.</span><div><strong>{adminSettings.store_profile?.store_name || "FORME"}</strong><small>STORE CONTROL</small></div></div>
          <div className="admin-nav">
            {(["overview","products","orders","customers","inventory","discounts","categories","settings"] as const).map((tab) => <button key={tab} className={adminTab === tab ? "active" : ""} onClick={() => setAdminTab(tab)}>{tab}</button>)}
          </div>
          <div className="admin-sidebar-bottom"><span>{userEmail}</span><button onClick={() => setAdminOpen(false)}>Back to storefront ↗</button><button onClick={async () => { await supabase?.auth.signOut(); setAdminOpen(false); }}>Sign out</button></div>
        </aside>
        <section className="admin-main">
          <header className="admin-topbar"><div><p className="eyebrow">FORME / CONTROL ROOM</p><h1>{adminTab === "overview" ? "Dashboard" : adminTab[0].toUpperCase() + adminTab.slice(1)}</h1></div><div className="admin-top-actions"><button onClick={() => void loadAdminData()}>↻ Refresh</button><button onClick={() => setAdminOpen(false)}>✕ Close</button></div></header>
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
                <label>Image URL<input name="image_url" type="url" defaultValue={editingProduct?.image_url ?? ""}/></label>
                <label>Description<textarea name="description" rows={3} defaultValue={editingProduct?.description ?? ""}/></label>
                <label>Ingredients<textarea name="ingredients" rows={3} defaultValue={editingProduct?.ingredients ?? ""}/></label>
                <label>How to use<textarea name="directions" rows={2} defaultValue={editingProduct?.directions ?? ""}/></label>
                <label>Warnings<textarea name="warnings" rows={2} defaultValue={editingProduct?.warnings ?? ""}/></label>
                <label className="admin-check-label"><input name="is_featured" type="checkbox" defaultChecked={editingProduct?.is_featured ?? false}/> Feature on storefront</label>
                <button className="admin-primary" type="submit">{editingProduct ? "Save changes" : "Create product"}</button>
              </form>
            </div>
            <div className="admin-panel"><div className="admin-panel-head"><h2>Catalogue ({adminProducts.length})</h2></div>
              {adminProducts.map(product => <div className="admin-row admin-product-row" key={product.id}><div><strong>{product.name}</strong><small>{product.sku || "No SKU"} · {product.category} · {product.stock} in stock</small></div><b>{money(Number(product.price))}</b><button onClick={() => { setEditingProduct(product); window.scrollTo({top:0,behavior:"smooth"}); }}>Edit</button><button className="admin-danger" onClick={() => void setAdminProductActive(product.id, product.is_active !== false)}>{product.is_active === false ? "Restore" : "Hide"}</button></div>)}
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
          {adminTab === "settings" && <div className="admin-content"><div className="admin-panel"><div className="admin-panel-head"><h2>Store experience</h2><span className="status-pill">Live configuration</span></div>
            <form className="admin-settings-form" key={JSON.stringify(adminSettings)} onSubmit={saveStoreSettings}>
              <h3>Brand and customer support</h3><div className="admin-form-grid"><label>Store name<input name="store_name" defaultValue={adminSettings.store_profile?.store_name ?? "FORME"}/></label><label>Support email<input name="support_email" type="email" defaultValue={adminSettings.store_profile?.support_email ?? ""}/></label><label>Support phone<input name="support_phone" defaultValue={adminSettings.store_profile?.support_phone ?? ""}/></label><label>WhatsApp number<input name="whatsapp_number" defaultValue={adminSettings.social?.whatsapp_number ?? ""}/></label></div>
              <h3>Delivery and checkout</h3><div className="admin-form-grid"><label>Standard delivery fee (EGP)<input name="standard_fee" type="number" min="0" step="0.01" defaultValue={adminSettings.shipping?.standard_fee ?? 60}/></label><label>Free delivery from (EGP)<input name="free_shipping_threshold" type="number" min="0" step="0.01" defaultValue={adminSettings.shipping?.free_shipping_threshold ?? 1500}/></label></div><label>Estimated delivery time<input name="estimated_delivery" defaultValue={adminSettings.shipping?.estimated_delivery ?? "2–5 business days"}/></label>
              <h3>Homepage messaging</h3><label>Announcement bar<input name="announcement" defaultValue={adminSettings.homepage?.announcement ?? ""}/></label><label>Hero headline<input name="hero_title" defaultValue={adminSettings.homepage?.hero_title ?? "Make every rep count."}/></label><label>Hero supporting text<textarea name="hero_subtitle" rows={3} defaultValue={adminSettings.homepage?.hero_subtitle ?? ""}/></label>
              <h3>Social links</h3><div className="admin-form-grid"><label>Instagram URL<input name="instagram_url" type="url" defaultValue={adminSettings.social?.instagram_url ?? ""}/></label><label>Facebook URL<input name="facebook_url" type="url" defaultValue={adminSettings.social?.facebook_url ?? ""}/></label></div>
                            <h3>InstaPay configuration</h3><div className="admin-form-grid"><label>InstaPay alias / registered number<input name="instapay_alias" defaultValue={adminSettings.payments?.instapay_alias ?? ""} placeholder="Enter the official receiving alias"/></label><label>Account holder name<input name="instapay_account_name" defaultValue={adminSettings.payments?.account_name ?? ""}/></label></div><label>Customer transfer instructions<textarea name="instapay_instructions" rows={3} defaultValue={adminSettings.payments?.instructions ?? ""}/></label><h3>Seller details and customer policies</h3><div className="admin-form-grid"><label>Registered business / legal name<input name="legal_name" defaultValue={adminSettings.legal?.legal_name ?? ""}/></label><label>Commercial registration number<input name="commercial_register" defaultValue={adminSettings.legal?.commercial_register ?? ""}/></label><label>Tax registration number<input name="tax_number" defaultValue={adminSettings.legal?.tax_number ?? ""}/></label><label>Business address<input name="business_address" defaultValue={adminSettings.legal?.business_address ?? ""}/></label></div><label>Returns and exchanges policy<textarea name="return_policy" rows={4} defaultValue={adminSettings.legal?.return_policy ?? ""} placeholder="Set out your accurate return, exchange and damaged-product process."/></label><label>Shipping and delivery policy<textarea name="shipping_policy" rows={4} defaultValue={adminSettings.legal?.shipping_policy ?? ""} placeholder="Coverage areas, delivery estimates, fees and failed-delivery process."/></label><label>Privacy policy<textarea name="privacy_policy" rows={5} defaultValue={adminSettings.legal?.privacy_policy ?? ""} placeholder="Explain what customer data you collect, why, how long it is kept and how customers can contact you."/></label><label>Terms and conditions<textarea name="terms_conditions" rows={5} defaultValue={adminSettings.legal?.terms_conditions ?? ""} placeholder="Order acceptance, pricing, payment, product information, liability and disputes."/></label>
              <button className="admin-primary" type="submit">Save all store settings</button>
            </form>
          </div></div>}
          {adminTab === "inventory" && <div className="admin-content"><div className="admin-stat-grid"><article><span>TOTAL UNITS</span><strong>{adminProducts.reduce((s,p) => s + Number(p.stock || 0),0)}</strong></article><article><span>LOW STOCK ITEMS</span><strong>{adminProducts.filter(p => p.stock <= (p.reorder_level ?? 5)).length}</strong></article><article><span>RECORDED MOVEMENTS</span><strong>{adminInventory.length}</strong></article></div><div className="admin-panel"><div className="admin-panel-head"><h2>Stock movement history</h2></div>
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