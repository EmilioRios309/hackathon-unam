# EDA inicial

Generado por `backend/scripts/eda_inicial.py`. Los archivos de `data/` no se modifican.

## Archivos

```
        dataset             archivo  filas  columnas  memoria_MB
          games           games.csv    122         7        0.03
pffScoutingData pffScoutingData.csv 188254        15       45.69
        players         players.csv   1679         7        0.49
          plays           plays.csv   8557        32        8.51
```

## games

Dimensiones: 122 filas x 7 columnas. Duplicados exactos: 0.

```
        columna dtype  nulos_%  unicos    ejemplo
         gameId int64      0.0     122 2021090900
         season int64      0.0       1       2021
           week int64      0.0       8          1
       gameDate   str      0.0      24 09/09/2021
gameTimeEastern   str      0.0       6   20:20:00
   homeTeamAbbr   str      0.0      32         TB
visitorTeamAbbr   str      0.0      32        DAL
```

EstadÃ­sticas numÃ©ricas:

```
columna  count         mean     std          min          25%          50%          75%          max
 gameId  122.0 2.021098e+09 4979.17 2021090900.0 2.021092e+09 2021100311.5 2.021102e+09 2021110100.0
 season  122.0 2.021000e+03    0.00       2021.0 2.021000e+03       2021.0 2.021000e+03       2021.0
   week  122.0 4.390000e+00    2.29          1.0 2.000000e+00          4.0 6.000000e+00          8.0
```

## pffScoutingData

Dimensiones: 188,254 filas x 15 columnas. Duplicados exactos: 0.

```
               columna   dtype  nulos_%  unicos    ejemplo
                gameId   int64     0.00     122 2021090900
                playId   int64     0.00    3762         97
                 nflId   int64     0.00    1679      25511
              pff_role     str     0.00       5       Pass
   pff_positionLinedUp     str     0.00      56         QB
               pff_hit float64    50.00       2        0.0
             pff_hurry float64    50.00       2        1.0
              pff_sack float64    50.00       2        0.0
  pff_beatenByDefender float64    74.46       2        0.0
        pff_hitAllowed float64    74.46       2        0.0
      pff_hurryAllowed float64    74.46       2        0.0
       pff_sackAllowed float64    74.46       2        0.0
pff_nflIdBlockedPlayer float64    75.29     665    44955.0
         pff_blockType     str    74.55      12         SW
    pff_backFieldBlock float64    74.55       2        0.0
```

EstadÃ­sticas numÃ©ricas:

```
               columna    count         mean     std          min          25%          50%          75%          max
                gameId 188254.0 2.021098e+09 4970.19 2021090900.0 2021091913.0 2021100312.0 2021101710.0 2021110100.0
                playId 188254.0 2.159220e+03 1222.72         54.0       1127.0       2156.0       3196.0       5223.0
                 nflId 188254.0 4.572353e+04 5016.11      25511.0      42445.0      45339.0      48053.0      54038.0
               pff_hit  94127.0 1.000000e-02    0.09          0.0          0.0          0.0          0.0          1.0
             pff_hurry  94127.0 3.000000e-02    0.17          0.0          0.0          0.0          0.0          1.0
              pff_sack  94127.0 1.000000e-02    0.08          0.0          0.0          0.0          0.0          1.0
  pff_beatenByDefender  48087.0 4.000000e-02    0.20          0.0          0.0          0.0          0.0          1.0
        pff_hitAllowed  48087.0 1.000000e-02    0.11          0.0          0.0          0.0          0.0          1.0
      pff_hurryAllowed  48087.0 4.000000e-02    0.20          0.0          0.0          0.0          0.0          1.0
       pff_sackAllowed  48087.0 1.000000e-02    0.09          0.0          0.0          0.0          0.0          1.0
pff_nflIdBlockedPlayer  46526.0 4.517881e+04 4836.93      33131.0      42401.0      44877.0      47832.0      53999.0
    pff_backFieldBlock  47903.0 4.000000e-02    0.20          0.0          0.0          0.0          0.0          1.0
```

## players

Dimensiones: 1,679 filas x 7 columnas. Duplicados exactos: 0.

```
         columna dtype  nulos_%  unicos    ejemplo
           nflId int64     0.00    1679      25511
          height   str     0.00      16        6-4
          weight int64     0.00     176        225
       birthDate   str    13.82    1174 1977-08-03
     collegeName   str    13.34     236   Michigan
officialPosition   str     0.00      19         QB
     displayName   str     0.00    1671  Tom Brady
```

EstadÃ­sticas numÃ©ricas:

```
columna  count     mean     std     min     25%     50%     75%     max
  nflId 1679.0 46473.37 5041.68 25511.0 43295.5 46167.0 52451.5 54038.0
 weight 1679.0   246.18   47.36   158.0   205.0   236.0   292.0   380.0
```

## plays

Dimensiones: 8,557 filas x 32 columnas. Duplicados exactos: 0.

```
               columna   dtype  nulos_%  unicos                                                           ejemplo
                gameId   int64     0.00     122                                                        2021090900
                playId   int64     0.00    3762                                                                97
       playDescription     str     0.00    8555 (13:33) (Shotgun) T.Brady pass incomplete deep right to C.Godwin.
               quarter   int64     0.00       5                                                                 1
                  down   int64     0.00       5                                                                 3
             yardsToGo   int64     0.00      32                                                                 2
        possessionTeam     str     0.00      32                                                                TB
         defensiveTeam     str     0.00      32                                                               DAL
          yardlineSide     str     1.46      32                                                                TB
        yardlineNumber   int64     0.00      50                                                                33
             gameClock     str     0.00     898                                                             13:33
      preSnapHomeScore   int64     0.00      42                                                                 0
   preSnapVisitorScore   int64     0.00      38                                                                 0
            passResult     str     0.00       5                                                                 I
          penaltyYards float64    91.17      60                                                               0.0
  prePenaltyPlayResult   int64     0.00      98                                                                 0
            playResult   int64     0.00     102                                                                 0
             foulName1     str    91.40      29                                              Illegal Use of Hands
            foulNFLId1 float64    91.40     486                                                           52459.0
             foulName2     str    99.65      15                                             Unnecessary Roughness
            foulNFLId2 float64    99.65      30                                                           44955.0
             foulName3     str    99.99       1                                                   Illegal Contact
            foulNFLId3 float64    99.99       1                                                           46190.0
absoluteYardlineNumber float64     0.01      99                                                              43.0
      offenseFormation     str     0.08       7                                                           SHOTGUN
            personnelO     str     0.01      30                                                  1 RB, 1 TE, 3 WR
        defendersInBox float64     0.08      11                                                               6.0
            personnelD     str     0.01      29                                                  4 DL, 2 LB, 5 DB
          dropBackType     str     6.17       8                                                       TRADITIONAL
        pff_playAction   int64     0.00       2                                                                 0
      pff_passCoverage     str     0.00      12                                                           Cover-1
  pff_passCoverageType     str     0.00       3                                                               Man
```

EstadÃ­sticas numÃ©ricas:

```
               columna  count         mean     std          min          25%          50%          75%          max
                gameId 8557.0 2.021098e+09 4970.47 2021090900.0 2021091913.0 2021100312.0 2.021102e+09 2021110100.0
                playId 8557.0 2.159220e+03 1222.79         54.0       1127.0       2156.0 3.196000e+03       5223.0
               quarter 8557.0 2.620000e+00    1.13          1.0          2.0          3.0 4.000000e+00          5.0
                  down 8557.0 1.970000e+00    0.87          0.0          1.0          2.0 3.000000e+00          4.0
             yardsToGo 8557.0 8.720000e+00    3.91          0.0          6.0         10.0 1.000000e+01         39.0
        yardlineNumber 8557.0 2.991000e+01   12.51          1.0         22.0         30.0 4.000000e+01         50.0
      preSnapHomeScore 8557.0 1.167000e+01    9.82          0.0          3.0         10.0 1.700000e+01         54.0
   preSnapVisitorScore 8557.0 1.126000e+01   10.03          0.0          3.0         10.0 1.700000e+01         44.0
          penaltyYards  756.0 3.530000e+00   11.62        -18.0         -5.0          4.0 1.125000e+01         50.0
  prePenaltyPlayResult 8557.0 6.500000e+00   10.20        -34.0          0.0          4.0 1.000000e+01         91.0
            playResult 8557.0 6.560000e+00   10.61        -34.0          0.0          5.0 1.100000e+01         91.0
            foulNFLId1  736.0 4.571396e+04 4839.31      30869.0      42460.0      45571.0 4.792900e+04      53957.0
            foulNFLId2   30.0 4.719487e+04 3523.96      40107.0      44968.5      46167.0 4.808250e+04      53679.0
            foulNFLId3    1.0 4.619000e+04     NaN      46190.0      46190.0      46190.0 4.619000e+04      46190.0
absoluteYardlineNumber 8556.0 5.925000e+01   23.66         11.0         40.0         59.0 7.900000e+01        109.0
        defendersInBox 8550.0 6.020000e+00    1.01          1.0          5.0          6.0 7.000000e+00         11.0
        pff_playAction 8557.0 2.400000e-01    0.43          0.0          0.0          0.0 0.000000e+00          1.0
```

Columnas con valores negativos (revisar si son legÃ­timos):

```
             columna  negativos
        penaltyYards        217
prePenaltyPlayResult        569
          playResult        753
```

## Integridad de claves

- games: clave ['gameId'], duplicados de clave = 0
- players: clave ['nflId'], duplicados de clave = 0
- plays: clave ['gameId', 'playId'], duplicados de clave = 0
- pffScoutingData: clave ['gameId', 'playId', 'nflId'], duplicados de clave = 0
- plays con gameId ausente en games: 0
- pffScoutingData con nflId ausente en players: 0
- pffScoutingData sin jugada en plays: 0

## Registros por temporada

```
 season  juegos  semana_min  semana_max  semanas  jugadas  registros_pff
   2021     122           1           8        8     8557         188254
```

Juegos con season fuera de 2010-2026: 0
Fechas invÃ¡lidas en gameDate: 0. Rango: 2021-09-09 a 2021-11-01
Fechas con aÃ±o distinto a season (por fecha, enero-febrero pertenece a la temporada previa): 0

Juegos por semana:

```
 week  juegos
    1      16
    2      16
    3      16
    4      16
    5      16
    6      14
    7      13
    8      15
```

## Registros por posiciÃ³n


players.officialPosition:

```
officialPosition  jugadores
              WR        210
              CB        192
              DE        142
             OLB        136
              RB        126
               T        122
              TE        121
              DT        114
               G         99
             ILB         81
              FS         72
              SS         69
              QB         60
               C         55
              NT         34
             MLB         27
              FB         15
              LB          2
              DB          2
```

Registros pffScoutingData por officialPosition:

```
officialPosition  registros
              CB      23913
              WR      23078
               T      17926
               G      16546
              DE      13646
             OLB      12972
              TE      10496
              FS      10108
              DT       9828
              SS       9160
              RB       8593
              QB       8589
             ILB       8516
               C       8414
              NT       2952
             MLB       2895
              FB        531
              DB         86
              LB          5
```

Registros pffScoutingData por pff_positionLinedUp:

```
pff_positionLinedUp  registros
                 QB       8557
                  C       8557
                 LT       8557
                 LG       8557
                 RG       8557
                 RT       8555
                RCB       8224
                LCB       8159
                LWR       8134
                RWR       8033
               ROLB       5325
               LOLB       5070
                DRT       4812
                LEO       4659
                DLT       4371
                REO       4287
                LLB       4202
                FSL       3793
                FSR       3764
                RLB       3627
               SLWR       3546
                 FS       3512
               RILB       3490
               SRWR       3468
               SCBR       3422
               LILB       3336
               SCBL       3246
                 LE       3204
               HB-L       2870
               HB-R       2676
                 RE       2383
               TE-R       2241
              SRoWR       1820
              SRiWR       1820
              SCBoL       1690
               TE-L       1675
                 HB       1624
                MLB       1595
              SLoWR       1432
              SLiWR       1432
              SCBoR       1342
                 NT       1255
              SCBiL       1125
              SCBiR        906
                SSL        799
                SSR        758
                NRT        752
                NLT        593
              TE-oR        487
              TE-iR        487
                 SS        424
              TE-oL        292
              TE-iL        292
               FB-R        176
                 FB        147
               FB-L        137
```

Formatos de height distintos de 'pies-pulgadas': 0
Peso fuera de 150-450 lb: 0
birthDate nulo/ilegible: 232. Formatos mezclados: {10: 1447}

## Chequeos de rango en plays

- quarter: fuera de [1, 5] = 0, nulos = 0
- down: fuera de [0, 4] = 0, nulos = 0
- yardsToGo: fuera de [0, 50] = 0, nulos = 0
- yardlineNumber: fuera de [0, 50] = 0, nulos = 0
- preSnapHomeScore: fuera de [0, 100] = 0, nulos = 0
- preSnapVisitorScore: fuera de [0, 100] = 0, nulos = 0
- playResult: fuera de [-30, 99] = 1, nulos = 0
- absoluteYardlineNumber: fuera de [0, 120] = 0, nulos = 1
- defendersInBox: fuera de [0, 11] = 0, nulos = 7

## Hallazgos y pendientes de limpieza (revisión manual)

- Cobertura: solo temporada 2021, semanas 1 a 8 (122 juegos). Las semanas 6 a 8 tienen 13 a 15 juegos (descansos). Ningún año cae fuera de 2010-2026.
- No hay datos de tracking (x, y, velocidad). Solo games, plays, players y pffScoutingData.
- Nulos estructurales en pffScoutingData: pff_hit, pff_hurry y pff_sack existen solo para pass rushers (50% nulos). Los campos *Allowed y pff_beatenByDefender existen solo para pass blockers (74% nulos). No imputar con 0 sin filtrar por pff_role.
- plays: down = 0 en 35 jugadas (probables conversiones de 2 puntos o jugadas especiales). quarter = 5 en 98 (tiempo extra). penaltyYards y foul* son nulos cuando no hay falta.
- plays: yardlineSide nulo 1.46%, dropBackType nulo 6.17%, defendersInBox nulo en 7, absoluteYardlineNumber nulo en 1, offenseFormation nulo en 6.
- Los negativos de playResult, prePenaltyPlayResult y penaltyYards son legítimos (sacks, pérdidas, faltas).
- players: birthDate nulo 13.8% y collegeName nulo 13.3%. height es texto "pies-pulgadas" (ej. 6-4) y hay que convertirlo a pulgadas. officialPosition incluye LB (2) y DB (2) genéricos junto a ILB/OLB/MLB y CB/FS/SS.
- pff_positionLinedUp tiene 56 valores (izquierda/derecha, slot); conviene agruparlos.
- playId no es único (3762 valores en 8557 jugadas). La clave es (gameId, playId).
- Sin duplicados exactos ni de clave, y sin llaves huérfanas entre tablas.

