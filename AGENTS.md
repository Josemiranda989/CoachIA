Tengo una aplicación web de fitness llamada CoachIA (gym tracker personal). 
Es una SPA con Next.js/React y tema oscuro. Necesito mejorar el frontend en 
varias áreas concretas. Analiza el código y aplica las siguientes mejoras:

---

## 1. DISEÑO GENERAL Y CONSISTENCIA VISUAL

- La imagen de fondo (personaje muscular estilo cartoon) actualmente se muestra 
  desvanecida en todas las páginas. Hacer que sea más sutil o reemplazarla por 
  un patrón geométrico/gradiente temático de fitness que no compita visualmente 
  con el contenido.
- Establecer un sistema de diseño consistente: definir variables CSS/tokens para 
  colores primarios (naranja/ámbar que ya se usa), secundarios (verde para 
  "finalizado"), fondos de tarjeta, bordes y tipografía.
- El navbar superior tiene dos navegaciones duplicadas en el DOM (hay dos <nav> 
  con los mismos links). Limpiar el HTML y dejar solo una barra de navegación 
  responsiva.

---

## 2. DASHBOARD (página principal /)

- Mejorar el hero banner: el saludo "Buenos días, Jose." con la fecha debajo 
  funciona bien, pero agregar una barra de progreso semanal (ej: "3/5 días 
  completados esta semana") con estilo visual atractivo.
- Las tarjetas de navegación (Entrenamiento de Hoy, Generar con IA, Toda la 
  Semana, Métricas, Cargar JSON, Ayuda) tienen layout irregular: la tarjeta 
  principal ocupa todo el ancho, luego hay una grilla de 3 y debajo una de 2. 
  Hacer la grilla uniforme y responsiva (2 columnas en mobile, 3 en desktop), 
  con hover effects más pronunciados (scale + glow con el color de acento).
- La badge "NUEVO" en la tarjeta "Generar con IA" se ve bien, mantenerla pero 
  animarla con un pulso sutil.
- Agregar micro-animaciones de entrada con fade + slide-up al cargar las tarjetas 
  (stagger entre ellas).

---

## 3. PÁGINA DE RUTINA SEMANAL (/routine/week)

- Los días de la semana se muestran como texto plano con fondo oscuro. Convertir 
  cada día en una tarjeta colapsable/acordeón que muestre solo el nombre del día 
  y los badges de estado (Creatina ✓, Finalizado ✓) por defecto, y expanda para 
  ver los ejercicios.
- Los nombres de los días están en inglés (Monday, Tuesday). Mostrarlos en 
  español o hacer que respeten el locale.
- Las checkboxes de "Creatina" y "Finalizado" tienen buen diseño con color ámbar 
  y verde. Mejorar el tamaño del hit area para mobile y agregar animación de 
  check.
- Agregar un indicador visual de "día actual" (highlight/borde de color) para 
  el día de la semana correspondiente.

---

## 4. PÁGINA DE ENTRENAMIENTO DEL DÍA (/workout/today)

- Los inputs de kg y reps son campos de texto simples y pequeños. Rediseñarlos 
  como inputs numéricos grandes y táctiles (mínimo 48px de altura), con botones 
  +/- a los lados para incrementar/decrementar el valor fácilmente desde móvil.
- El nombre del ejercicio en naranja funciona bien. Agregar un separador visual 
  claro entre ejercicios y una indicación de progreso (ej: "Ejercicio 2 de 6").
- Agregar un botón flotante "Guardar sesión" (FAB) fijo en la parte inferior de 
  la pantalla en mobile.
- El título "Gym + Bici 🏋️ 🚴" con emojis es informal pero funciona; agregar 
  debajo un resumen rápido: total de ejercicios, sets totales del día.

---

## 5. PÁGINA DE MÉTRICAS (/metrics)

- Las tarjetas de estadísticas (Volumen Histórico, Récord Sentadilla, Tiempo 
  Total Bici, etc.) son funcionales pero planas. Mejorar con:
  - Iconos relevantes por métrica (pesa, trofeo, reloj, bici, corazón)
  - Animación de conteo (count-up) al cargar los números
  - Color de acento diferenciado para métricas de Gym (ámbar/naranja) vs 
    métricas de Bici (azul/cian)
- La tarjeta "Ver Todos los Récords" tiene borde naranja y se destaca bien. 
  Agregar una flecha o ícono de navegación para indicar que es clickeable.
- Mejorar el layout: en desktop, usar una grilla de 3 columnas; en mobile, 2 
  columnas para las métricas pequeñas.

---

## 6. PÁGINA DE GENERAR RUTINA CON IA (/routine/generate)

- El formulario es funcional. Mejorar la UX de los chips de "Enfoque Muscular" 
  (Pecho, Espalda, Piernas, etc.): que tengan un estado selected visible más 
  claro con fill de color en lugar de solo borde, y un ícono/emoji por grupo 
  muscular.
- El botón "Generar Rutina" en azul contrasta con el resto del diseño que usa 
  naranja/ámbar. Cambiarlo al color primario de la app (naranja/ámbar) con 
  el ícono de sparkles que ya tiene.
- Agregar un estado de loading skeleton mientras la IA genera la respuesta.
- El textarea de "Notas Adicionales" tiene un resize handle visible. Hacerlo 
  resize: vertical only o fixed height con scroll interno.

---

## 7. RESPONSIVIDAD Y MOBILE

- La app parece diseñada primero para desktop. Auditar y mejorar el layout en 
  viewport 375px (iPhone SE) y 390px (iPhone 14):
  - Navbar: en mobile, colapsar en un hamburger menu o bottom navigation bar
  - Dashboard cards: 1 columna en mobile pequeño, 2 en tablet
  - Workout inputs: tamaños táctiles correctos (mínimo 44px)
- Agregar un bottom navigation bar para mobile con los 4 destinos principales 
  (Dashboard, Hoy, Rutina, Métricas) que sea más ergonómico que el navbar superior.

---

## 8. DETALLES Y POLISH

- El botón "← Volver" en todas las sub-páginas se ve muy simple. Darle estilo 
  consistente con ícono de flecha y hover effect.
- Agregar transiciones de página suaves (fade) al navegar entre rutas.
- El emoji/ícono junto al título "Métricas 🟦" y "Tu Semana en un Vistazo 🟦" 
  parecen placeholders (cuadros blancos). Reemplazarlos por emojis o iconos SVG 
  apropiados.
- Asegurarse de que todos los elementos interactivos tengan focus states visibles 
  para accesibilidad.

---

Prioridad de implementación: primero los puntos 7 (mobile) y 4 (workout inputs), 
ya que son los que más afectan el uso real de la app en el gimnasio. Luego los 
puntos 2 (dashboard), 5 (métricas) y 6 (generar rutina). Finalmente el resto.

Mantener el tema oscuro, el personaje mascota y el sistema de colores naranja/ámbar 
como identidad visual de la app.