import Link from "next/link";
import { Zap, Ban, Droplets, Clock, Apple, AlertTriangle } from "lucide-react";
import { BackLink } from "@/components/BackLink";

type FuelItem = {
  name: string;
  brand?: string;
  carbsPer: string;
  portion: string;
  carbsPerPortion: number;
  tip?: string;
  timing: "first-half" | "second-half" | "any";
};

const FUEL_ITEMS: FuelItem[] = [
  {
    name: "Gomitas Mogul",
    brand: "Arcor",
    carbsPer: "80g / 100g",
    portion: "50g (~10 gomitas)",
    carbsPerPortion: 40,
    tip: "La mejor relacion costo/beneficio. Arma bolsitas zip de 50g.",
    timing: "any",
  },
  {
    name: "Bocaditos de Membrillo",
    brand: "Pizzarro",
    carbsPer: "65g / 100g",
    portion: "1 unidad (~38g)",
    carbsPerPortion: 25,
    tip: "Faciles de abrir con los dientes. Llevar 4-5 por salida larga.",
    timing: "first-half",
  },
  {
    name: "Dulce de Membrillo (bloque)",
    brand: "Arcor / La Campagnola",
    carbsPer: "70g / 100g",
    portion: "Cubo de ~40g",
    carbsPerPortion: 28,
    tip: "Corta cubos en casa y llevalos en papel film. Mas barato que bocaditos.",
    timing: "first-half",
  },
  {
    name: "Banana",
    brand: "Fruta fresca",
    carbsPer: "23g / 100g",
    portion: "1 unidad mediana (~120g)",
    carbsPerPortion: 27,
    tip: "Clasica del ciclismo. Pelala antes y llevala en papel aluminio.",
    timing: "first-half",
  },
  {
    name: "Datiles",
    brand: "A granel / Granix",
    carbsPer: "75g / 100g",
    portion: "3-4 datiles (~40g)",
    carbsPerPortion: 30,
    tip: "Energia rapida y natural. Sacales el carozo antes de salir.",
    timing: "any",
  },
  {
    name: "Pasas de uva",
    brand: "A granel / Arcor",
    carbsPer: "79g / 100g",
    portion: "Puñado (~40g)",
    carbsPerPortion: 32,
    tip: "Muy compactas, faciles de llevar en bolsita.",
    timing: "any",
  },
  {
    name: "Barrita Cereal Mix",
    brand: "Arcor",
    carbsPer: "72g / 100g",
    portion: "1 barrita (23g)",
    carbsPerPortion: 17,
    tip: "Buena para la primera hora. Son un poco secas, tomar agua despues.",
    timing: "first-half",
  },
  {
    name: "Barrita Cereal Fort",
    brand: "Felfort",
    carbsPer: "68g / 100g",
    portion: "1 barrita (21g)",
    carbsPerPortion: 14,
    tip: "Viene con chips de chocolate. Facil de conseguir en kioscos. Liviana y practica.",
    timing: "first-half",
  },
  {
    name: "Barrita Nature Valley",
    brand: "Nature Valley",
    carbsPer: "64g / 100g",
    portion: "1 barrita (42g)",
    carbsPerPortion: 27,
    tip: "Se desmigaja bastante — llevala sin abrir hasta que la vayas a comer. Buena carga de carbos.",
    timing: "first-half",
  },
  {
    name: "Barra Que lo Paleo",
    brand: "Que lo Paleo (Tucuman)",
    carbsPer: "48g / 100g",
    portion: "1 barra (50g)",
    carbsPerPortion: 24,
    tip: "Tucumana, sin azucar agregada, 174 kcal y 10g de proteina. Sabor choco negro y blanco. Energia sostenida, baja en grasa (4.2g).",
    timing: "first-half",
  },
  {
    name: "Turron blando de mani",
    brand: "Arcor / Georgalos",
    carbsPer: "55g / 100g",
    portion: "1 unidad (~30g)",
    carbsPerPortion: 17,
    tip: "Aporta algo de proteina. Mejor para salidas tranquilas.",
    timing: "first-half",
  },
  {
    name: "Mermelada en sobrecitos",
    brand: "BC / Arcor",
    carbsPer: "65g / 100g",
    portion: "1 sobrecito (20g)",
    carbsPerPortion: 13,
    tip: "Se toman como un gel casero. Lleva 3-4 de backup.",
    timing: "second-half",
  },
  {
    name: "Sandwich de mermelada",
    brand: "Casero",
    carbsPer: "~50g / 100g",
    portion: "1 sandwich (pan + mermelada)",
    carbsPerPortion: 40,
    tip: "Pan blanco lactal + mermelada abundante. Envolve bien en film.",
    timing: "first-half",
  },
  {
    name: "Gel energetico Hidromax",
    brand: "Hidromax",
    carbsPer: "~70g / 100g",
    portion: "1 gel (40g)",
    carbsPerPortion: 28,
    tip: "Rapida absorcion, no necesita masticar. Ideal para el final.",
    timing: "second-half",
  },
  {
    name: "Gomitas Trolli / Haribo",
    brand: "Trolli / Haribo",
    carbsPer: "77g / 100g",
    portion: "50g",
    carbsPerPortion: 38,
    tip: "Alternativa importada a las Mogul. Mismo concepto.",
    timing: "any",
  },
];

type AvoidItem = {
  name: string;
  reason: string;
};

const AVOID_ITEMS: AvoidItem[] = [
  { name: "Alfajores", reason: "Alto en grasa (chocolate + dulce de leche). Digestion lenta, malestar en esfuerzo." },
  { name: "Chocolate / Barritas de chocolate", reason: "Grasa + se derrite al calor. Digestion lenta arriba de la bici." },
  { name: "Galletitas rellenas (Oreo, Rumba)", reason: "Grasa hidrogenada + azucar. Pesadas en el estomago." },
  { name: "Frutos secos solos (nueces, almendras)", reason: "Buena grasa pero pesimos carbos para esfuerzo. Digestion muy lenta." },
  { name: "Fiambres / Queso", reason: "Proteina + grasa = digestion de 2+ horas. No vas a tener energia disponible." },
  { name: "Facturas / Medialunas", reason: "Mucha grasa y manteca. Se desarman en el bolsillo del jersey." },
  { name: "Frutas citricas (naranja, pomelo)", reason: "Acidas, pueden causar reflujo en esfuerzo. Pocas calorias para el volumen." },
  { name: "Bebidas gasificadas", reason: "El gas genera distension abdominal. Cero utilidad deportiva." },
];

type FuelPlan = {
  duration: string;
  carbGoal: string;
  hydration: string;
  plan: string[];
};

const FUEL_PLANS: FuelPlan[] = [
  {
    duration: "1 - 1.5 horas",
    carbGoal: "30-60g totales",
    hydration: "500ml agua o con electrolitos",
    plan: [
      "Opcional: 1 banana o puñado de gomitas al minuto 40",
      "Bidon con electrolitos alcanza para mantener rendimiento",
      "No es critico comer si desayunaste bien",
    ],
  },
  {
    duration: "2 - 2.5 horas",
    carbGoal: "120-150g totales (60g/h)",
    hydration: "1 - 1.5L con electrolitos",
    plan: [
      "Min 30: 1 banana o 2 bocaditos de membrillo",
      "Min 60: Puñado de gomitas Mogul (50g)",
      "Min 90: 2 bocaditos de membrillo o datiles",
      "Min 120: 1 gel si queda tramo exigente",
    ],
  },
  {
    duration: "3+ horas (fondo)",
    carbGoal: "180-270g totales (60-90g/h)",
    hydration: "1.5 - 2.5L con electrolitos",
    plan: [
      "Min 30: Sandwich de mermelada o banana + bocaditos",
      "Min 60: 50g de gomitas Mogul + agua",
      "Min 90: 2-3 bocaditos de membrillo o cubos de dulce",
      "Min 120: 1 gel Hidromax (sin cafeina)",
      "Min 150: Datiles o gomitas + agua",
      "Min 160+: Gel con cafeina (reservar para el final)",
    ],
  },
];

function TimingBadge({ timing }: { timing: FuelItem["timing"] }) {
  const config = {
    "first-half": { label: "1ra mitad", bg: "rgba(16, 185, 129, 0.15)", color: "#10b981", border: "rgba(16, 185, 129, 0.3)" },
    "second-half": { label: "2da mitad", bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", border: "rgba(245, 158, 11, 0.3)" },
    any: { label: "Cualquier momento", bg: "rgba(99, 102, 241, 0.15)", color: "#818cf8", border: "rgba(99, 102, 241, 0.3)" },
  };
  const c = config[timing];
  return (
    <span
      className="text-xxs font-bold uppercase tracking-widest px-2 py-1 rounded-full"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {c.label}
    </span>
  );
}

export default function NutritionPage() {
  return (
    <div className="app-container py-10 pb-24 md:pb-10">
      <BackLink href="/" label="Volver al Dashboard" />

      {/* Hero */}
      <header className="mb-10 animate-fade-up">
        <div className="flex items-center gap-2 mb-3">
          <Apple className="text-[var(--accent-cycling)]" size={16} />
          <span className="text-[var(--accent-cycling)] font-semibold uppercase tracking-widest text-xs">
            Guia de Nutricion
          </span>
        </div>
        <h1 className="title text-3xl md:text-4xl mb-3">
          Combustible para la Bici
        </h1>
        <p className="subtitle text-base md:text-lg max-w-2xl">
          Que comer, cuanto y cuando durante tus salidas en bici.
          Productos reales que conseguis en cualquier kiosco o supermercado de Argentina.
        </p>
      </header>

      {/* Table of contents */}
      <nav
        className="mb-8 flex flex-wrap gap-2 animate-fade-up"
        style={{ animationDelay: "30ms" }}
      >
        {[
          { href: "#regla", label: "Regla de oro" },
          { href: "#llevar", label: "Qué llevar" },
          { href: "#no-llevar", label: "Qué NO llevar" },
          { href: "#planes", label: "Planes" },
          { href: "#hidratacion", label: "Hidratación" },
          { href: "#cafeina", label: "Cafeína" },
          { href: "#pre-salida", label: "Pre-salida" },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg transition-all"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-secondary)",
              textDecoration: "none",
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>

      {/* Key principle */}
      <div
        id="regla"
        className="card mb-8 animate-fade-up scroll-mt-20"
        style={{
          background: "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(24,24,27,0.7) 60%)",
          animationDelay: "60ms",
        }}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/20 rounded-xl shrink-0">
            <Zap className="text-amber-400" size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--accent-gym)" }}>
              La regla de oro
            </h2>
            <p className="text-sm leading-relaxed text-text-secondary">
              <strong className="text-text-primary">60-90g de carbohidratos por hora</strong> en
              esfuerzos de mas de 90 minutos. Empeza a comer desde el minuto 30, luego cada 30-40 minutos.
              Cuando tenes hambre arriba de la bici, ya llegaste tarde.
            </p>
            <p className="text-sm mt-2 leading-relaxed text-text-secondary">
              La clave es: <strong className="text-text-primary">alto en carbohidratos simples, bajo en grasa y fibra</strong>.
              La grasa y la fibra enlentecen la digestion y te generan malestar en esfuerzo.
            </p>
          </div>
        </div>
      </div>

      {/* Fuel items grid */}
      <section id="llevar" className="mb-12 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="p-2 bg-accent-cycling-soft rounded-lg">
            <Zap className="text-[var(--accent-cycling)]" size={20} />
          </div>
          <h2 className="text-2xl font-bold">Que llevar en la bici</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FUEL_ITEMS.map((item, i) => (
            <div
              key={item.name}
              className="card animate-fade-up"
              style={{
                animationDelay: `${150 + i * 40}ms`,
                background: "var(--bg-card)",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-base text-text-primary">
                    {item.name}
                  </h3>
                  {item.brand && (
                    <p className="text-xs mt-1 text-text-secondary">
                      {item.brand}
                    </p>
                  )}
                </div>
                <TimingBadge timing={item.timing} />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                <div className="rounded-xl p-2 sm:p-3 text-center bg-surface-low">
                  <p className="text-xxs uppercase tracking-wider mb-1 text-text-secondary">
                    Carbos/100g
                  </p>
                  <p className="text-xs sm:text-sm font-bold" style={{ color: "var(--accent-gym)" }}>
                    {item.carbsPer}
                  </p>
                </div>
                <div className="rounded-xl p-2 sm:p-3 text-center bg-surface-low">
                  <p className="text-xxs uppercase tracking-wider mb-1 text-text-secondary">
                    Porcion
                  </p>
                  <p className="text-xs sm:text-sm font-bold text-text-primary">
                    {item.portion}
                  </p>
                </div>
                <div className="rounded-xl p-2 sm:p-3 text-center" style={{ background: "color-mix(in srgb, var(--accent-cycling) 8%, transparent)" }}>
                  <p className="text-xxs uppercase tracking-wider mb-1 text-text-secondary">
                    Carbos
                  </p>
                  <p className="text-xs sm:text-sm font-bold" style={{ color: "var(--accent-cycling)" }}>
                    {item.carbsPerPortion}g
                  </p>
                </div>
              </div>

              {item.tip && (
                <p className="text-xs leading-relaxed text-text-secondary">
                  {item.tip}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Avoid section */}
      <section id="no-llevar" className="mb-12 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6 animate-fade-up">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <Ban className="text-red-400" size={20} />
          </div>
          <h2 className="text-2xl font-bold">Que NO llevar</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AVOID_ITEMS.map((item, i) => (
            <div
              key={item.name}
              className="card animate-fade-up flex items-start gap-3"
              style={{
                animationDelay: `${i * 40}ms`,
                background: "linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(24,24,27,0.7) 60%)",
                borderColor: "rgba(220,38,38,0.15)",
              }}
            >
              <AlertTriangle className="text-red-400 shrink-0 mt-1" size={16} />
              <div>
                <h3 className="font-bold text-sm mb-1 text-text-primary">
                  {item.name}
                </h3>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {item.reason}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Fuel plans by duration */}
      <section id="planes" className="mb-12 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6 animate-fade-up">
          <div className="p-2 bg-accent-cycling-soft rounded-lg">
            <Clock className="text-[var(--accent-cycling)]" size={20} />
          </div>
          <h2 className="text-2xl font-bold">Plan segun duracion</h2>
        </div>

        <div className="space-y-4">
          {FUEL_PLANS.map((plan, i) => (
            <div
              key={plan.duration}
              className="card animate-fade-up"
              style={{
                animationDelay: `${i * 60}ms`,
                background: "linear-gradient(135deg, rgba(59,130,246,0.08) 0%, rgba(24,24,27,0.7) 60%)",
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
                <h3 className="text-lg font-bold text-text-primary">
                  {plan.duration}
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <span
                    className="text-xxs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}
                  >
                    Objetivo: {plan.carbGoal}
                  </span>
                  <span
                    className="text-xxs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
                    style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}
                  >
                    {plan.hydration}
                  </span>
                </div>
              </div>

              <ul className="space-y-2">
                {plan.plan.map((step, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-text-secondary">
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xxs font-bold mt-1"
                      style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}
                    >
                      {j + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Hydration section */}
      <section id="hidratacion" className="mb-12 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6 animate-fade-up">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Droplets className="text-cyan-400" size={20} />
          </div>
          <h2 className="text-2xl font-bold">Hidratacion</h2>
        </div>

        <div className="card animate-fade-up" style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(24,24,27,0.7) 60%)" }}>
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-sm mb-2 text-text-primary">Cuanto tomar</h3>
              <p className="text-sm text-text-secondary">
                <strong className="text-text-primary">500-750ml por hora</strong> dependiendo del calor
                y la intensidad. En verano argentino podes necesitar hasta 1L/h.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl p-4 bg-surface-low">
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#06b6d4" }}>
                  Salida corta (&lt;1.5h)
                </p>
                <p className="text-lg font-bold text-text-primary">500ml - 750ml</p>
                <p className="text-xs mt-1 text-text-secondary">
                  1 bidon. Agua sola o con electrolitos.
                </p>
              </div>
              <div className="rounded-xl p-4 bg-surface-low">
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#06b6d4" }}>
                  Salida media (2-3h)
                </p>
                <p className="text-lg font-bold text-text-primary">1.5L - 2L</p>
                <p className="text-xs mt-1 text-text-secondary">
                  2 bidones. Al menos 1 con Hidromax o electrolitos.
                </p>
              </div>
              <div className="rounded-xl p-4 bg-surface-low">
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#06b6d4" }}>
                  Fondo (3h+)
                </p>
                <p className="text-lg font-bold text-text-primary">2L - 2.5L+</p>
                <p className="text-xs mt-1 text-text-secondary">
                  2 bidones + parar a recargar. Ambos con electrolitos.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-sm mb-2 text-text-primary">Electrolitos</h3>
              <p className="text-sm text-text-secondary">
                <strong className="text-text-primary">Hidromax</strong> en el bidon aporta sodio, potasio
                y ~20-25g de carbos extra por litro. Es suficiente para salidas de hasta 2 horas.
                Para fondos mas largos, combina bidon de electrolitos + comida solida.
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.15)" }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--accent-gym)" }}>
                Senal de deshidratacion
              </p>
              <p className="text-xs text-text-secondary">
                Si tu orina post-salida es amarilla oscura, tomaste poco.
                El objetivo es que sea amarilla clara o transparente. Si te duele la cabeza o sentis mareo,
                para inmediatamente y toma agua.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Caffeine section */}
      <section id="cafeina" className="mb-12 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6 animate-fade-up">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <Zap className="text-amber-400" size={20} />
          </div>
          <h2 className="text-2xl font-bold">Cafeina</h2>
        </div>

        <div className="card animate-fade-up" style={{ background: "var(--bg-card)" }}>
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-text-secondary">
              La cafeina mejora el rendimiento y reduce la percepcion de esfuerzo, pero hay que usarla bien:
            </p>
            <ul className="space-y-2">
              {[
                "Reservala para la SEGUNDA MITAD de la salida (despues de 1:30h). Al principio estas fresco, no la necesitas.",
                "Dosis efectiva: 3-6mg por kg de peso corporal. Para ~80kg = 240-480mg totales. Un gel con cafeina tiene ~30-40mg.",
                "No combines gel con cafeina + cafe previo a la salida si no estas acostumbrado. Puede generar malestar gastrointestinal.",
                "Si salis temprano con cafe en el desayuno, el gel con cafeina esta bien para las ultimas horas.",
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                  <span
                    className="shrink-0 w-1.5 h-1.5 rounded-full mt-2"
                    style={{ background: "var(--accent-gym)" }}
                  />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Pre-ride meal */}
      <section id="pre-salida" className="mb-8 scroll-mt-20">
        <div className="flex items-center gap-3 mb-6 animate-fade-up">
          <div className="p-2 bg-accent-gym-soft rounded-lg">
            <Apple className="text-[var(--accent-gym)]" size={20} />
          </div>
          <h2 className="text-2xl font-bold">Comida pre-salida</h2>
        </div>

        <div className="card animate-fade-up" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(24,24,27,0.7) 60%)" }}>
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-text-secondary">
              Come <strong className="text-text-primary">2-3 horas antes</strong> de subirte a la bici.
              El objetivo: cargar glucogeno sin que el estomago este lleno.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl p-4 bg-surface-low">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#a78bfa" }}>
                  Opciones ideales
                </p>
                <ul className="space-y-2">
                  {[
                    "Tostadas con mermelada + cafe con leche",
                    "Avena cocida con banana y miel",
                    "Pan con dulce de membrillo + yogur",
                    "Arroz blanco con mermelada (si salis muy temprano)",
                    "Granola con leche + fruta",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="text-[var(--accent-cycling)] shrink-0">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl p-4 bg-surface-low">
                <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#a78bfa" }}>
                  Evitar antes de salir
                </p>
                <ul className="space-y-2">
                  {[
                    "Huevos fritos / Tortilla (grasa = digestion lenta)",
                    "Fiambres y queso (proteina pesada)",
                    "Mucha fibra (cereales integrales, frutas con cascara)",
                    "Lacteos en exceso (si te generan hinchazón)",
                    "Nada nuevo el dia de un fondo largo",
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="text-red-400 shrink-0">-</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.15)" }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "#a78bfa" }}>
                Regla del dia de fondo
              </p>
              <p className="text-xs text-text-secondary">
                NUNCA pruebes comida nueva el dia de una salida larga. Proba todo en entrenamientos cortos primero.
                Lo que le funciona a otro ciclista puede generarte malestar a vos.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
