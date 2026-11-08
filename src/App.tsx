import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, Menu, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

gsap.registerPlugin(ScrollTrigger);

type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  image_url: string | null;
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [notice, setNotice] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [category, setCategory] = useState("ALL");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.from("products").select("id,name,category,description,price,stock,image_url").eq("is_active", true).order("created_at")
      .then(({ data, error }) => {
        if (!active) return;
        if (!error && data?.length) setProducts(data as Product[]);
      });
    supabase.auth.getSession().then(({ data }) => {
      if (active) setUserEmail(data.session?.user.email ?? null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user.email ?? null);
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

  const categories = ["ALL", ...Array.from(new Set(products.map((product) => product.category?.toUpperCase() ?? "OTHER")))];
  const visibleProducts = category === "ALL" ? products : products.filter((product) => product.category?.toUpperCase() === category);
  const cartItems = products.filter((product) => cart[product.id]).map((product) => ({ ...product, quantity: cart[product.id] }));
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const addToCart = (id: string) => setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  const changeQuantity = (id: string, delta: number) => setCart((current) => {
    const next = (current[id] ?? 0) + delta;
    const updated = { ...current };
    if (next <= 0) delete updated[id]; else updated[id] = next;
    return updated;
  });

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
          <div className="drawer-total"><span>SUBTOTAL</span><strong>{money(cartTotal)}</strong></div><p className="checkout-note">Shipping and payment details are confirmed at checkout.</p><button className="button button-dark full-button" onClick={() => setNotice("Checkout is the next build step. Your bag is saved in this session.")}>Continue to checkout <ArrowRight size={16}/></button>
        </>}</aside></div>}

      {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><section className="auth-modal" onClick={(event) => event.stopPropagation()}><button className="icon-button modal-close" onClick={() => setAuthOpen(false)}><X/></button><p className="eyebrow">WELCOME TO FORME</p><h2>{authMode === "login" ? "Good to see you." : "Start your standard."}</h2><p className="auth-sub">Your account keeps your orders and details in one place.</p><form onSubmit={handleAuth}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com"/></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="At least 8 characters"/></label><button className="button button-dark full-button" type="submit">{authMode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16}/></button></form><button className="switch-auth" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}</button></section></div>}

      {notice && <div className="toast" role="status"><Check size={16}/>{notice}<button onClick={() => setNotice("")}><X size={14}/></button></div>}
      {!isSupabaseConfigured && <div className="setup-hint">PREVIEW MODE · Add your Supabase keys in <code>.env</code> to activate accounts and live products.</div>}
    </>
  );
}

export default App;