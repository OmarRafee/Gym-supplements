# FORME — Gym Supplements Store

A luxury, motion-led React storefront for a sports nutrition brand. Built with React, TypeScript, Vite, GSAP and Supabase.

## Stack
- React + TypeScript + Vite
- GSAP + ScrollTrigger for the scroll-led product reveal
- Supabase Auth + PostgreSQL + Row Level Security
- Lucide icons

## Local setup
1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add the Supabase project URL and publishable key.
5. Run `npm run dev`.

Never put a Supabase service-role or secret key in a browser environment variable. Only the publishable key belongs in this React app.

## Current experience
- Responsive luxury storefront and product catalogue
- ScrollTrigger bottle-opening / powder / product reveal prototype
- Product list reads from the Supabase `products` table when configured
- Sign up and sign in through Supabase Auth
- Session cart UI

## Next implementation milestones
1. Finish secure checkout and stock reservation with a server-side database function.
2. Add account profiles, order history and payment-method records.
3. Add admin role provisioning, product management, inventory movements and analytics.
4. Add product image uploads and storage policies.
5. Integrate a licensed 3D bottle model / product-specific image sequence for physically accurate powder simulation.
6. Connect a Visa payment provider after merchant onboarding. InstaPay can start as manual transfer confirmation; COD can be enabled immediately.

## Product animation reference
The current visual is a branded concept tub inspired by the silhouette of a real product: **Optimum Nutrition Gold Standard 100% Whey**. The artwork is intentionally a placeholder, not an official product photo or endorsement. Replace it with licensed product imagery or a custom GLB model before launch.

## Brand note
FORME is a working visual identity and placeholder brand name. Confirm the final brand name, logo and product catalog before public launch.