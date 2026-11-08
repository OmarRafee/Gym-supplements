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
  category: string;
  description: string;
  price: number;
  cost_price?: number | null;
  compare_at_price?: number | null;
  reorder_level?: number;
  stock: number;
  image_url: string | null;
  is_active?: boolean;
};

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
  total: number;
  created_at: string;
  order_items?: { product_name: string; quantity: number; line_total: number }[];
};

const fallbackProducts: Product[] = [
  { id: "whey", name: "Gold Standard Whey", category: "PROTEIN", description: "A daily essential. Smooth texture, considered nutrition.", price: 1500, stock: 50, image_url: null },
  { id: "creatine", name: "Creatine Monohydrate", category: "PERFORMANCE", description: "Pure creatine for strength, power and consistency.", price: 600, stock: 80, image_url: null },
  { id: "pre", name: "Pre-Workout", category: "ENERGY", description: "A focused formula for the work ahead.", price: 750, stock: 40, image_url: null },
];

const money = (value: number) => new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 }).format(value);

function App() {
  const heroRef = useRef<HTMLElement>(null);
  const bottleRef = useRef<HTMLDivElement>(null);
  const capRef = useRef<HTMLDivElement>(null);
  const powderRef = useRef<HTMLDivElement>(null);
  const productStageRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [notice, setNotice] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminTab, setAdminTab] = useState<"overview" | "products" | "orders" | "customers" | "inventory">("overview");
  const [adminProducts, setAdminProducts] = useState<Product[]>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [adminCustomers, setAdminCustomers] = useState<any[]>([]);
  const [adminInventory, setAdminInventory] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState("ALL");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.from("products").select("id,name,category,description,price,stock,image_url").eq("is_active", true).order("created_at")
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data?.length) setProducts(data as Product[]);
      });
    const syncUser = async (userId: string | null, userEmailValue: string | null) => {
      if (!active) return;
      setUserEmail(userEmailValue);
      if (!userId) { setIsAdmin(false); setAdminOpen(false); return; }
      const { data: adminRow, error: adminError } = await supabase
        .from("admins").select("user_id").eq("user_id", userId).maybeSingle();
      if (active) setIsAdmin(!adminError && Boolean(adminRow));
    };
    supabase.auth.getSession().then(({ data }) => {
      void syncUser(data.session?.user.id ?? null, data.session?.user.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user.id ?? null, session?.user.email ?? null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro.from(".nav-inner", { y: -24, opacity: 0, duration: 0.8 })
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
        story.to(".hero-copy", { yPercent: -22, opacity: 0.15, duration: 0.35 }, 0)
          .to(capRef.current, { y: -68, rotate: -24, x: 18, duration: 0.28, ease: "power2.in" }, 0.15)
          .to(powderRef.current, { opacity: 1, scale: 1, y: 26, duration: 0.35, ease: "power2.out" }, 0.32)
          .to(".powder-grain", { y: 125, x: "random(-90, 90)", opacity: 0, stagger: 0.008, duration: 0.5, ease: "power1.in" }, 0.42)
          .to(productStageRef.current, { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: "back.out(1.2)" }, 0.58)
          .to(".stage-product", { y: 0, rotate: 0, opacity: 1, stagger: 0.08, duration: 0.45, ease: "back.out(1.5)" }, 0.6);
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
    const [productResult, orderResult, customerResult, inventoryResult] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("orders").select("id,order_number,full_name,phone,address,city,status,payment_method,payment_status,total,created_at,order_items(product_name,quantity,line_total)").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id,full_name,phone,address,city,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("inventory_movements").select("id,product_id,order_id,movement_type,quantity_change,stock_before,stock_after,reason,created_at,products(name,sku)").order("created_at", { ascending: false }).limit(100),
    ]);
    if (productResult.error) setNotice("Products: " + productResult.error.message);
    else setAdminProducts((productResult.data ?? []) as Product[]);
    if (orderResult.error) setNotice("Orders: " + orderResult.error.message);
    else setAdminOrders((orderResult.data ?? []) as AdminOrder[]);
    if (customerResult.error) setNotice("Customers: " + customerResult.error.message);
    else setAdminCustomers(customerResult.data ?? []);
    if (inventoryResult.error) setNotice("Inventory: " + inventoryResult.error.message);
    else setAdminInventory(inventoryResult.data ?? []);
    setAdminLoading(false);
  }

  async function saveAdminProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !isAdmin) return;
    const form = new FormData(event.currentTarget);
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
    event.currentTarget.reset();
    setNotice(editingProduct ? "Product updated." : "Product added.");
    await loadAdminData();
    const { data } = await supabase.from("products").select("id,name,category,description,price,stock,image_url").eq("is_active", true).order("created_at");
    if (data) setProducts(data as Product[]);
  }

  async function archiveAdminProduct(id: string) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", id);
    if (error) setNotice(error.message);
    else { setNotice("Product hidden from the storefront."); await loadAdminData(); setProducts((current) => current.filter((p) => p.id !== id)); }
  }

  async function updateAdminOrder(id: string, field: "status" | "payment_status", value: string) {
    if (!supabase || !isAdmin) return;
    const { error } = await supabase.from("orders").update({ [field]: value }).eq("id", id);
    if (error) setNotice(error.message);
    else { setNotice("Order updated."); await loadAdminData(); }
  }

  const categories = ["ALL", ...Array.from(new Set(products.map((product) => product.category?.toUpperCase() ?? "OTHER")))];
  const visibleProducts = category === "ALL" ? products : products.filter((product) => product.category?.toUpperCase() === category);
  const cartItems = products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] }));
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const addToCart = (id: string) => {
    const product = products.find((item) => item.id === id);
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
    const { data, error } = await supabase.rpc("place_order", payload);
    if (error) { setNotice(error.message); return; }
    setCart({});
    setCheckoutOpen(false);
    setNotice("Order placed. Reference: " + String(data).slice(0, 8));
  }

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) { setNotice("Connect your Supabase environment variables to enable accounts."); return; }
    const result = authMode === "signup"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) setNotice(result.error.message);
    else { setNotice(authMode === "signup" ? "Account created. Check your email if confirmation is enabled." : "Welcome back."); setAuthOpen(false); }
  }

  return (
    <>
      <header className="site-header">
        <div className="nav-inner">
          <a className="wordmark" href="#top">FORME<span>®</span></a>
          <nav className={menuOpen ? "main-nav is-open" : "main-nav"}>
            <a href="#shop" onClick={() => setMenuOpen(false)}>Shop</a>
            <a href="#philosophy" onClick={() => setMenuOpen(false)}>Our standard</a>
            <a href="#journal" onClick={() => setMenuOpen(false)}>Journal</a>
          </nav>
          <div className="nav-actions">
            {isAdmin && <button className="text-button admin-nav-button" onClick={() => { setAdminOpen(true); setAdminTab("overview"); void loadAdminData(); }}>ADMIN</button>}
            <button className="text-button account-button" onClick={() => { setAuthMode("login"); setAuthOpen(true); }}>{userEmail ? userEmail.split("@")[0] : "Account"}</button>
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
              <h1>Make every<br/><em>rep</em> count.</h1>
              <p className="hero-description">Precision nutrition for people who take their progress personally. Nothing extra. Nothing overlooked.</p>
              <div className="hero-links"><a className="button button-light" href="#shop">Explore the collection <ArrowUpRight size={16}/></a><span>BUILT FOR THE LONG RUN</span></div>
            </div>
            <div className="hero-visual">
              <div className="visual-orbit orbit-one"/><div className="visual-orbit orbit-two"/>
              <div className="hero-product-label"><span>01 / THE DAILY STANDARD</span><span>WHEY · 2 LB</span></div>
              <div className="bottle-wrap" ref={bottleRef}>
                <div className="bottle-cap" ref={capRef}><div className="cap-ridges"/></div>
                <div className="bottle">
                  <div className="bottle-neck"/>
                  <div className="bottle-label"><span className="label-brand">FORME</span><span className="label-rule"/><strong>WHEY<br/>PROTEIN</strong><small>GOLD STANDARD · 2 LB</small><span className="label-bottom">24G PROTEIN / SERVING</span></div>
                </div>
              </div>
              <div className="powder-cloud" ref={powderRef}>
                {Array.from({length: 38}, (_, i) => <i className="powder-grain" key={i} style={{ left: `${(i * 37) % 100}%`, top: `${(i * 19) % 65}%`, width: `${3 + (i % 5)}px`, height: `${3 + (i % 5)}px` }}/>)}
                <div className="powder-pour"/>
              </div>
              <div className="stage-products" ref={productStageRef}>
                <div className="stage-product stage-one"><span>FORME / 02</span><strong>CREATINE</strong><small>PURE MONOHYDRATE</small></div>
                <div className="stage-product stage-two"><span>FORME / 03</span><strong>DAILY<br/>GREENS</strong><small>DAILY RITUAL</small></div>
                <div className="stage-product stage-three"><span>FORME / 04</span><strong>PRE<br/>WORKOUT</strong><small>FOCUS + ENERGY</small></div>
              </div>
              <span className="scroll-cue"><ArrowDown size={14}/> SCROLL TO UNSEAL</span>
            </div>
          </div>
          <div className="hero-foot"><span>FORMULATED WITH INTENTION</span><span>CAIRO · EGYPT</span><span>01 — 04</span></div>
        </section>

        <div className="ticker"><div className="ticker-track">{Array.from({length: 8}, (_, i) => <span key={i}>DISCIPLINE IS A DAILY PRACTICE <b>✳</b> PERFORMANCE, WITHOUT COMPROMISE <b>✳</b></span>)}</div></div>

        <section className="shop-section section-pad" id="shop">
          <div className="section-heading reveal"><div><p className="eyebrow">THE COLLECTION / 001—006</p><h2>Essentials for<br/><em>what’s next.</em></h2></div><p>Thoughtful formulas. Transparent ingredients.<br/>Made to earn their place in your routine.</p></div>
          <div className="filter-row reveal"><div className="filters">{categories.map((item) => <button key={item} className={category === item ? "filter active" : "filter"} onClick={() => setCategory(item)}>{item}</button>)}</div><span>{visibleProducts.length.toString().padStart(2,"0")} PRODUCTS</span></div>
          <div className="product-grid">
            {visibleProducts.map((product, index) => <article className="product-card reveal" key={product.id}>
              <div className={`product-art art-${index % 3}`}>
                <span className="product-index">0{index + 1} / FORME LABS</span>
                {product.image_url ? <img src={product.image_url} alt={product.name}/> : <div className="mini-tub"><span>FORME</span><strong>{product.name.toUpperCase()}</strong><small>{product.category?.toUpperCase()}</small></div>}
                <button className="quick-add" aria-label={`Add ${product.name} to bag`} onClick={() => addToCart(product.id)}><Plus size={18}/></button>
                <span className="stock-note">{product.stock > 0 ? "IN STOCK" : "SOLD OUT"}</span>
              </div>
              <div className="product-meta"><div><span>{product.category?.toUpperCase() ?? "FORME LABS"}</span><h3>{product.name}</h3></div><strong>{money(product.price)}</strong></div>
              <p className="product-description">{product.description}</p>
            </article>)}
          </div>
        </section>

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

        <section className="closing-cta"><p className="eyebrow">THE NEXT REP STARTS HERE</p><h2>Show up.<br/><em>Every day.</em></h2><a href="#shop" className="button button-light">Shop the collection <ArrowRight size={16}/></a></section>
      </main>

      <footer className="footer"><a className="wordmark" href="#top">FORME<span>®</span></a><span>PERFORMANCE, REFINED.</span><span>© 2026 FORME LABS</span><a href="#top">BACK TO TOP ↑</a></footer>

      {cartOpen && <div className="drawer-backdrop" onClick={() => setCartOpen(false)}><aside className="drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">YOUR SELECTION</p><h2>The bag <span>({cartItems.length})</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)}><X/></button></div>
        {cartItems.length === 0 ? <div className="empty-state"><ShoppingBag size={30}/><p>Your bag is waiting for something good.</p><button className="underlined-link" onClick={() => setCartOpen(false)}>Explore products <ArrowRight size={14}/></button></div> : <>
          <div className="drawer-items">{cartItems.map((item) => <div className="drawer-item" key={item.id}><div className="drawer-thumb">F.</div><div className="drawer-item-info"><strong>{item.name}</strong><span>{money(item.price)}</span><div className="quantity-control"><button onClick={() => changeQuantity(item.id, -1)}><Minus size={13}/></button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.id, 1)}><Plus size={13}/></button></div></div><strong>{money(item.price * item.quantity)}</strong></div>)}</div>
          <div className="drawer-total"><span>SUBTOTAL</span><strong>{money(cartTotal)}</strong></div><p className="checkout-note">Shipping and payment details are confirmed at checkout.</p><button className="button button-dark full-button" onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}>Continue to checkout <ArrowRight size={16}/></button>
        </>}</aside></div>}


      {checkoutOpen && <div className="modal-backdrop" onClick={() => setCheckoutOpen(false)}><section className="auth-modal checkout-modal" onClick={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={() => setCheckoutOpen(false)}><X/></button><p className="eyebrow">SECURE CHECKOUT</p><h2>Almost yours.</h2><p className="auth-sub">Delivery details · Total {money(cartTotal)}</p><form onSubmit={handleCheckout}><label>Full name<input name="full_name" required minLength={2} placeholder="Your full name"/></label><label>Phone number<input name="phone" required minLength={7} placeholder="+20"/></label><label>City<input name="city" required placeholder="Cairo"/></label><label>Delivery address<input name="address" required minLength={5} placeholder="Street, building, apartment"/></label><label>Payment method<select name="payment_method" defaultValue="cod"><option value="cod">Cash on delivery</option><option value="instapay">InstaPay transfer (manual confirmation)</option></select></label><label>Delivery notes (optional)<input name="notes" placeholder="Anything we should know?"/></label><button className="button button-dark full-button" type="submit">Place order <ArrowRight size={16}/></button></form></section></div>}

      {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><section className="auth-modal" onClick={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={() => setAuthOpen(false)}><X/></button><p className="eyebrow">WELCOME TO FORME</p><h2>{authMode === "login" ? "Good to see you." : "Start your standard."}</h2><p className="auth-sub">Your account keeps your orders and details in one place.</p><form onSubmit={handleAuth}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com"/></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={authMode === "signup" ? 8 : 6} required placeholder={authMode === "signup" ? "At least 8 characters" : "Your password"}/></label><button className="button button-dark full-button" type="submit">{authMode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16}/></button></form><button className="switch-auth" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button></section></div>}


      {adminOpen && isAdmin && <div className="admin-overlay">
        <aside className="admin-sidebar">
          <div className="admin-brand"><span className="admin-brand-mark">F.</span><div><strong>FORME</strong><small>STORE CONTROL</small></div></div>
          <div className="admin-nav">
            {(["overview","products","orders","customers","inventory"] as const).map((tab) => <button key={tab} className={adminTab === tab ? "active" : ""} onClick={() => setAdminTab(tab)}>{tab}</button>)}
          </div>
          <div className="admin-sidebar-bottom"><span>{userEmail}</span><button onClick={() => setAdminOpen(false)}>Back to storefront ↗</button><button onClick={async () => { await supabase?.auth.signOut(); setAdminOpen(false); }}>Sign out</button></div>
        </aside>
        <section className="admin-main">
          <header className="admin-topbar"><div><p className="eyebrow">FORME / CONTROL ROOM</p><h1>{adminTab === "overview" ? "Dashboard" : adminTab[0].toUpperCase() + adminTab.slice(1)}</h1></div><div className="admin-top-actions"><button onClick={() => void loadAdminData()}>↻ Refresh</button><button onClick={() => setAdminOpen(false)}>✕ Close</button></div></header>
          {adminLoading && <p className="admin-loading">Updating live store data…</p>}
          {adminTab === "overview" && <div className="admin-content">
            <div className="admin-stat-grid">
              <article><span>ORDERS</span><strong>{adminOrders.length}</strong><small>Latest 100 orders</small></article>
              <article><span>GROSS ORDER VALUE</span><strong>{money(adminOrders.filter(o => o.status !== "cancelled").reduce((s,o) => s + Number(o.total || 0),0))}</strong><small>Based on loaded orders</small></article>
              <article><span>ACTIVE PRODUCTS</span><strong>{adminProducts.filter(p => p.is_active !== false).length}</strong><small>Store catalogue</small></article>
              <article><span>LOW STOCK</span><strong>{adminProducts.filter(p => p.is_active !== false && p.stock <= (p.reorder_level ?? 5)).length}</strong><small>At or below reorder level</small></article>
            </div>
            <div className="admin-panel"><div className="admin-panel-head"><h2>Recent orders</h2><button onClick={() => setAdminTab("orders")}>View all ↗</button></div>
              {adminOrders.slice(0,6).map(order => <div className="admin-row" key={order.id}><div><strong>{order.order_number || order.id.slice(0,8)}</strong><small>{order.full_name} · {new Date(order.created_at).toLocaleString()}</small></div><span className={"status-pill status-" + order.status}>{order.status}</span><b>{money(Number(order.total))}</b></div>)}
              {!adminOrders.length && <p className="admin-empty">No real orders yet. New customer checkouts will appear here.</p>}
            </div>
          </div>}
          {adminTab === "products" && <div className="admin-content admin-products-layout">
            <div className="admin-panel admin-editor"><div className="admin-panel-head"><h2>{editingProduct ? "Edit product" : "Add a product"}</h2>{editingProduct && <button onClick={() => setEditingProduct(null)}>Cancel edit</button>}</div>
              <form className="admin-product-form" onSubmit={saveAdminProduct}>
                <label>Product name<input name="name" required defaultValue={editingProduct?.name ?? ""}/></label>
                <label>Slug<input name="slug" defaultValue={editingProduct?.slug ?? ""} placeholder="auto-generated if blank"/></label>
                <label>SKU<input name="sku" defaultValue={editingProduct?.sku ?? ""}/></label>
                <label>Brand<input name="brand" defaultValue={editingProduct?.brand ?? ""}/></label>
                <label>Category<input name="category" required defaultValue={editingProduct?.category ?? ""} placeholder="Protein / Recovery"/></label>
                <label>Size<input name="size_label" defaultValue={editingProduct?.size_label ?? ""} placeholder="2 lb / 900 g"/></label>
                <div className="admin-form-grid"><label>Price (EGP)<input name="price" type="number" min="0" step="0.01" required defaultValue={editingProduct?.price ?? ""}/></label><label>Cost (EGP)<input name="cost_price" type="number" min="0" step="0.01" defaultValue={editingProduct?.cost_price ?? ""}/></label></div>
                <div className="admin-form-grid"><label>Stock<input name="stock" type="number" min="0" step="1" required defaultValue={editingProduct?.stock ?? 0}/></label><label>Reorder at<input name="reorder_level" type="number" min="0" step="1" defaultValue={editingProduct?.reorder_level ?? 5}/></label></div>
                <label>Compare-at price<input name="compare_at_price" type="number" min="0" step="0.01" defaultValue={editingProduct?.compare_at_price ?? ""}/></label>
                <label>Servings<input name="servings" type="number" min="1" step="1" defaultValue={editingProduct?.servings ?? ""}/></label>
                <label>Image URL<input name="image_url" type="url" defaultValue={editingProduct?.image_url ?? ""}/></label>
                <label>Description<textarea name="description" rows={3} defaultValue={editingProduct?.description ?? ""}/></label>
                <button className="admin-primary" type="submit">{editingProduct ? "Save changes" : "Create product"}</button>
              </form>
            </div>
            <div className="admin-panel"><div className="admin-panel-head"><h2>Catalogue ({adminProducts.length})</h2></div>
              {adminProducts.map(product => <div className="admin-row admin-product-row" key={product.id}><div><strong>{product.name}</strong><small>{product.sku || "No SKU"} · {product.category} · {product.stock} in stock</small></div><b>{money(Number(product.price))}</b><button onClick={() => { setEditingProduct(product); window.scrollTo({top:0,behavior:"smooth"}); }}>Edit</button><button className="admin-danger" onClick={() => void archiveAdminProduct(product.id)}>Hide</button></div>)}
            </div>
          </div>}
          {adminTab === "orders" && <div className="admin-content"><div className="admin-panel"><div className="admin-panel-head"><h2>Orders ({adminOrders.length})</h2></div>
            {adminOrders.map(order => <article className="admin-order-card" key={order.id}><div className="admin-order-head"><div><strong>{order.order_number || order.id.slice(0,8)}</strong><small>{order.full_name} · {order.phone} · {order.city}</small><small>{order.address}</small></div><b>{money(Number(order.total))}</b></div>
              <div className="admin-order-lines">{(order.order_items ?? []).map((item,i) => <span key={i}>{item.product_name} × {item.quantity} <b>{money(Number(item.line_total))}</b></span>)}</div>
              <div className="admin-order-controls"><label>Order status<select value={order.status} onChange={e => void updateAdminOrder(order.id,"status",e.target.value)}>{["pending","confirmed","shipped","delivered","cancelled"].map(s => <option key={s}>{s}</option>)}</select></label><label>Payment status<select value={order.payment_status} onChange={e => void updateAdminOrder(order.id,"payment_status",e.target.value)}>{["pending","awaiting_confirmation","paid","failed","refunded"].map(s => <option key={s}>{s}</option>)}</select></label><span>{order.payment_method.toUpperCase()} · {new Date(order.created_at).toLocaleString()}</span></div>
            </article>)}
            {!adminOrders.length && <p className="admin-empty">No orders have been placed yet.</p>}
          </div></div>}
          {adminTab === "customers" && <div className="admin-content"><div className="admin-panel"><div className="admin-panel-head"><h2>Customer profiles ({adminCustomers.length})</h2></div>
            {adminCustomers.map(customer => <div className="admin-row" key={customer.id}><div><strong>{customer.full_name || "Customer"}</strong><small>{customer.phone || "No phone"} · {customer.city || "No city"}</small><small>{customer.address || "No saved address"}</small></div><small>Joined {new Date(customer.created_at).toLocaleDateString()}</small></div>)}
            {!adminCustomers.length && <p className="admin-empty">No customer profiles yet.</p>}
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