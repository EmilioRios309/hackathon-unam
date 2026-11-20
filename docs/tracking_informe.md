# Informe de tracking: qué aporta a NFL Pressure Lab

Fuente: `data/tracking/` con 122 archivos (uno por juego), 8.3 millones de filas y 10 cuadros por segundo. Hay 23 entidades por cuadro (22 jugadores más el balón). Las coordenadas se normalizaron para que la ofensiva siempre avance hacia la derecha. Se cruzó con `pffScoutingData` para identificar rushers y QB. La población es la misma de la app: 7,766 dropbacks sin falta ni 2 puntos.

## Calidad

- Hay tracking para las 8,557 jugadas. 24 no tienen evento de snap (se excluyen). De la población de la app quedan 7,743 jugadas (99.7%).
- Las 122 tablas juntas ocupan 1.7 GB en memoria con solo 11 columnas. Leer y procesar todo toma unos 13 s.
- El tiempo hasta lanzar (TTT) tiene mediana de 2.8 s. Hay 34 jugadas con más de 8 s, que son scrambles largos.
- Las air yards no son confiables: solo 391 intentos tienen `pass_arrived` u otro evento de llegada. No se usan.

## Hallazgos

1. **El TTT explica la presión.** La tasa de presión sube de 11% con menos de 2 s a 78% con 5 s o más. La de sack sube de 0.2% a 22%.
2. **La presión cuesta más cuando el QB retiene el balón.** Costo en yardas por intento (con presión menos sin presión, IC95 bootstrap):

   | TTT | Costo | IC95 |
   |---|---|---|
   | < 2.5 s | -0.9 | [-1.6, -0.2] |
   | 2.5-3.5 s | -3.1 | [-3.9, -2.3] |
   | > 3.5 s | -3.8 | [-5.3, -2.4] |

   El promedio único de -2.0 de la app esconde esta diferencia.
3. **La distancia rusher-QB valida a PFF.** La distancia mínima del rusher más cercano predice la presión de PFF con AUC 0.884, y coincide con ella en 80% de las jugadas. Con un rusher a menos de 1.5 yd al lanzar, el % de completos es 37% y hay 4.2 yardas por intento. Con más de 5 yd, el % es 73% y hay 9.4 yardas por intento.
4. **Las métricas físicas del rusher siguen a las de PFF.** Entre los 82 rushers con 150 snaps o más:
   - El % de snaps en que llega a 2 yd del QB correlaciona 0.79 con la Pressure Rate ajustada.
   - La velocidad máxima en el primer segundo correlaciona 0.51.
   - Líderes en llegar a 2 yd: Hendrickson (24.5%), Garrett (24.0%) y Ngakoue (22.2%).
   - Líderes en velocidad de salida: Floyd (4.44 yd/s), Gary (4.32) y Von Miller (4.23).
5. **El QB controla buena parte de su presión.** El TTT mediano por QB correlaciona 0.63 con su tasa de presión. Roethlisberger y Brady lanzan en 2.5-2.6 s y reciben 25-26% de presión. Lamar Jackson y Winston lanzan en 3.2 s y reciben 39-44%.
6. **Las señales previas al snap aportan poco.** Se probaron: defensores en la línea, profundidad del segundo safety, defensor más cercano al QB y velocidad defensiva.

   | Modelo de presión (validación por juego) | AUC |
   |---|---|
   | Sin rushers | 0.581 |
   | Sin rushers, más tracking del snap | 0.592 |
   | App actual (con rushers) | 0.608 |
   | App actual más tracking del snap | 0.609 |
   | Más TTT (posterior al snap) | 0.765 |

   La presión depende de lo que pasa después del snap. Mostrar defensores en la línea contra los rushers reales sí sirve como dato de disfraz del blitz: con un rusher más de los que se veían en la línea, la presión sube de 34% a 43%.

## Mejoras recomendadas para la app

| Prioridad | Mejora | Valor | Dificultad |
|---|---|---|---|
| 1 | Agregar el TTT como palanca del simulador (lanzar rápido o retener) | Pasa de "¿hubo presión?" a "¿cuándo lanzar?", y el costo cambia de -0.9 a -3.8 yd | Media |
| 2 | Campo 2D animado de la jugada real en el simulador | Se ve la presión, la distancia del rusher y el momento del lanzamiento | Media |
| 3 | Métricas físicas en Pass rush contra línea: velocidad de salida, % de llegada a 2 yd y tiempo hasta llegar | Validan a PFF con datos físicos y diferencian rushers | Baja |
| 4 | TTT y distancia al lanzar en la tarjeta del QB | Separa la presión que permite la línea de la que causa el QB | Baja |
| 5 | Indicador de disfraz del blitz (rushers reales contra defensores en la línea) | Perspectiva defensiva más rica | Baja |
| - | No usar air yards ni subir el modelo pre-snap con tracking | Datos incompletos o sin ganancia | - |

## Arquitectura

- Cargar los 850 MB al arrancar no es viable en un servidor efímero, y escribir caché en disco va contra las reglas.
- Al arrancar se procesaría juego por juego, con 11 columnas, y solo se guardarían agregados por jugada y por rusher (unos 8.5k y 35k registros). Toma unos 13 s y ocupa pocos MB.
- Para la animación, el endpoint leería el CSV de ese juego bajo demanda (unos 0.1 s), filtraría la jugada y devolvería los cuadros del snap al lanzamiento.
