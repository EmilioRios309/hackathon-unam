# NFL Pressure Lab

NFL Pressure Lab es un dashboard que analiza la presión sobre el quarterback con datos de PFF y tracking de la NFL (temporada 2021, semanas 1 a 8). Permite revisar cada jugada en un campo 2D animado y simular qué habría pasado si la defensa enviaba otro número de rushers o el QB tardaba otro tiempo en lanzar. A diferencia de los dashboards que solo cuentan sacks o presiones, mide cuándo y qué tan cerca llega la presión, y separa la que permite la línea ofensiva de la que provoca el propio QB al retener el balón. Su hallazgo principal es que la presión le cuesta al QB 2.0 yardas por intento en promedio, pero ese costo pasa de 0.9 yardas si lanza en menos de 2.5 s a 4.0 yardas si retiene el balón más de 3.5 s. Está pensado para coordinadores ofensivos y defensivos, coaches de línea y analistas de rendimiento que preparan planes de juego o evalúan jugadores.

![Simulador de presión: campo 2D de un pase de Tom Brady contra Dallas, con las trayectorias del pass rush, los duelos de bloqueo y la distancia del rusher más cercano al QB](docs/img/campo-2d.png)

*Simulador de presión, TB contra DAL, 3.º y 2. Los círculos rojos marcan a los rushers que generaron presión. La gráfica inferior muestra cómo se cierra la distancia entre el rusher más cercano y el QB hasta el lanzamiento, a los 3.2 s.*
