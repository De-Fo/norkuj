/**
 * Per-district landing page copy (/bydleni/<slug>).
 * Each intro is unique and references the district's real transit, geography
 * and character so pages are not templated filler. Edit freely.
 */

export interface DistrictContent {
  title: string      // H1, e.g. "Pronájem bytu Vinohrady bez realitky"
  intro: string[]    // 1-3 short paragraphs (~60-90 words total)
  nearby: string[]   // related districts / parent groups for internal linking
}

const BASE = 'Pronájem bytu '

export const DISTRICT_CONTENT: Record<string, DistrictContent> = {
  // ── Centro (Praha 1) ──
  'Praha 1': {
    title: 'Pronájem bytu Praha 1 bez realitky',
    intro: [
      'Centrum Prahy znamená Staré Město, Malou Stranu a Hradčany v docházkové vzdálenosti od všech hlavních památek. Metr A (stanice Staroměstská, Můstek) a tramvaje z Národní třídy a Karlova mostu tě dostanou kamkoliv.',
      'Na Norkuj najdeš byty a ateliéry v historických domech přímo od majitelů. Bez provize realitky a bez zbytečných poplatků.',
    ],
    nearby: ['Staré Město', 'Malá Strana', 'Hradčany', 'Nové Město'],
  },
  'Staré Město': {
    title: BASE + 'Staré Město bez realitky',
    intro: [
      'Historické jádro s orlojem, Pařížskou ulicí a nábřežím Vltavy. Metr A na Staroměstské a tramvaje č. 17, 2 a 22 spojují Staré Město s Vinohrady i Holešovicemi.',
      'Najdi si byt v centru přímo od majitele - bez provize, s jasnou cenou a bez zbytečné administrativy.',
    ],
    nearby: ['Praha 1', 'Malá Strana', 'Nové Město', 'Vinohrady'],
  },
  'Malá Strana': {
    title: BASE + 'Malá Strana bez realitky',
    intro: [
      'Barokní čtvrť pod Pražským hradem s klidnými uličkami a výhledy na Vltavu. Tramvajová zastávka Malostranská (linky 12, 20, 22) a pěšky 10 minut na Hrad.',
      'Pronájem na Malé Straně je ideální pro klidné bydlení v centru. Kontaktuj majitele napřímo a bez provize.',
    ],
    nearby: ['Praha 1', 'Hradčany', 'Staré Město', 'Smíchov'],
  },
  'Hradčany': {
    title: BASE + 'Hradčany bez realitky',
    intro: [
      'Reprezentativní čtvrť kolem Pražského hradu, Loretánského náměstí a Strahovského kláštera. Tramvaje 22 a 23 a metro A na Hradčanské.',
      'Klidné bydlení v dosahu centra, s výhledy na střechy Prahy. Inzeráty přímo od majitelů, bez provize.',
    ],
    nearby: ['Praha 1', 'Malá Strana', 'Dejvice', 'Břevnov'],
  },

  // ── Praha 2 (Nové Město, Vyšehrad, Vinohrady) ──
  'Praha 2': {
    title: 'Pronájem bytu Praha 2 bez realitky',
    intro: [
      'Živá čtvrť mezi Karlovým náměstím, Nuselským údolím a Vyšehradem. Metro B na Karlově náměstí, tramvaje přes I. P. Pavlova a dostupnost do centra pěšky.',
      'Bydlení v Praze 2 znamená kavárny, parky a klidné ulice plné secese. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Nové Město', 'Vinohrady', 'Vyšehrad', 'Nusle'],
  },
  'Nové Město': {
    title: BASE + 'Nové Město bez realitky',
    intro: [
      'Od Václavského náměstí po Karlovo náměstí a Náplavku. Metro A i B (Můstek, Karlovo náměstí) a tramvaje na Národní třídě.',
      'Nové Město spojuje ruch centra s řekou, kde je Náplavka plná života. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 1', 'Praha 2', 'Vinohrady', 'Staré Město'],
  },
  'Vyšehrad': {
    title: BASE + 'Vyšehrad bez realitky',
    intro: [
      'Prestižní lokalita pod historickým Vyšehradem s parky a výhledy na Vltavu. Metro C na Vyšehradě a tramvaje č. 2, 3 a 17.',
      'Klidné bydlení blízko centra, obklopené zelení. Bez realitky, napřímo od majitelů.',
    ],
    nearby: ['Praha 2', 'Nusle', 'Podolí', 'Praha 4'],
  },

  // ── Vinohrady (top-quarter, shared across 2/3/10) ──
  'Vinohrady': {
    title: 'Pronájem bytu Vinohrady bez realitky',
    intro: [
      'Nejoblíbenější pražská čtvrť pro bydlení - secesní domy, kavárny, Riegrovy sady a Havlíčkovy sady. Metro A (Jiřího z Poděbrad, Flora, Želivského) a tramvaje 11, 13 a 22.',
      'Vinohrady se táhnou přes Prahu 2, 3 i 10 a patří k nejžádanějším adresám v Praze. Norkuj ti ukáže byty přímo od majitelů, bez provize realitky a bez zbytečných poplatků.',
    ],
    nearby: ['Praha 2', 'Praha 3', 'Žižkov', 'Vršovice', 'Nové Město'],
  },

  // ── Žižkov ──
  'Žižkov': {
    title: 'Pronájem bytu Žižkov bez realitky',
    intro: [
      'Autentický Žižkov s televizní věží, Parukářkou a největší žižkovskou věží v Evropě. Metro A na Floře a tramvaje 5, 9, 15 a 26.',
      'Bydlení na Žižkově je cenově dostupnější než na sousedních Vinohradech, přitom má skvělou dostupnost do centra. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 3', 'Vinohrady', 'Karlín', 'Vysočany'],
  },

  // ── Praha 3 ──
  'Praha 3': {
    title: 'Pronájem bytu Praha 3 bez realitky',
    intro: [
      'Praha 3 je domovem Žižkova, části Vinohrad a Vysočan - živé čtvrti s metrem A a tramvajemi 5, 9 a 26.',
      'Od historických ulic po novější zástavbu, Praha 3 nabízí rozmanité bydlení blízko centra. Norkuj spojuje přímo nájemníky s majiteli.',
    ],
    nearby: ['Žižkov', 'Vinohrady', 'Vysočany', 'Karlín', 'Praha 1'],
  },

  // ── Karlín ──
  'Karlín': {
    title: 'Pronájem bytu Karlín bez realitky',
    intro: [
      'Nejrychleji rostoucí pražská čtvrť - kanceláře, kavárny a byty podél náplavky a Křižíkovy ulice. Metro B na Florenci a Křižíkově, tramvaje 3, 5, 8 a 24.',
      'Karlín je oblíbený u mladých profesionálů díky dostupnosti do centra i kancelářských zón. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 8', 'Praha 3', 'Žižkov', 'Libeň', 'Holešovice'],
  },

  // ── Holešovice ──
  'Holešovice': {
    title: 'Pronájem bytu Holešovice bez realitky',
    intro: [
      'Kreativní Holešovice s DOX, Jatkami 78, Marketem a vltavským nábřežím. Metro C na Nádraží Holešovice a Vltavské, tramvaje 6, 12, 17 a 26.',
      'Bydlení v Holešovicích kombinuje industriální styl s moderními kavárnami a galeriemi. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 7', 'Bubeneč', 'Karlín', 'Troja', 'Libeň'],
  },

  // ── Smíchov ──
  'Smíchov': {
    title: 'Pronájem bytu Smíchov bez realitky',
    intro: [
      'Živá čtvrť na levém břehu Vltavy s Andělem, Novým Smíchovem a náplavkou. Metro B na Andělu a Smíchovském nádraží, tramvaje 4, 7, 12 a 20.',
      'Smíchov nabízí skvělou dostupnost do centra i na letiště a roste jako kancelářská a bytová lokalita. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Praha 5', 'Malá Strana', 'Radlice', 'Holešovice'],
  },

  // ── Praha 4 (Nusle, Podolí, Krč, Braník, Chodov, Háje...) ──
  'Praha 4': {
    title: 'Pronájem bytu Praha 4 bez realitky',
    intro: [
      'Rozlehlá Praha 4 zahrnuje Nusle, Podolí, Krč, Braník i jižní sídliště Chodov a Háje. Metro C vede po celé délce čtvrti, tramvaje 2, 3, 4, 17 a 18.',
      'Od rodinného bydlení u Vltavy po moderní byty u metra - Praha 4 nabízí širokou škálu cen i typů. Inzeráty přímo od majitelů, bez provize.',
    ],
    nearby: ['Nusle', 'Podolí', 'Krč', 'Braník', 'Vinohrady'],
  },
  'Nusle': {
    title: BASE + 'Nusle bez realitky',
    intro: [
      'Kopcovitá čtvrť mezi Nuselským mostem a Folimankou, s tramvajemi 6, 7, 11, 13 a 18 a metrem C na Vyšehradě a I. P. Pavlova.',
      'Nusle jsou cenově dostupné a blízko centra i Vinohrad. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 4', 'Praha 2', 'Vinohrady', 'Podolí', 'Vyšehrad'],
  },
  'Podolí': {
    title: BASE + 'Podolí bez realitky',
    intro: [
      'Klidná čtvrť u Vltavy s plaveckým areálem, parkem a výhledy na Prahu. Tramvaje 2, 3, 17 a 18 a pěšky k vltavské náplavce.',
      'Podolí je oblíbené pro bydlení blízko řeky i centra. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Praha 4', 'Nusle', 'Braník', 'Vyšehrad'],
  },
  'Braník': {
    title: BASE + 'Braník bez realitky',
    intro: [
      'Příjemná čtvrť u Vltavy mezi Podolím a Modřany, s tramvajemi 2, 3, 17 a 18 a metrem C na Pankráci.',
      'Braník kombinuje rodinné domy i bytové domy v zeleni. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 4', 'Podolí', 'Krč', 'Hodkovičky'],
  },
  'Krč': {
    title: BASE + 'Krč bez realitky',
    intro: [
      'Zelená čtvrť s nemocnicí a velkým sportovním areálem, metrem C na Pražského povstání a tramvajemi 4, 18 a 19.',
      'Krč nabízí klidné bydlení s dobrou dostupností do centra. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 4', 'Braník', 'Michle', 'Praha 11'],
  },
  'Háje': {
    title: BASE + 'Háje bez realitky',
    intro: [
      'Nejjižnější část metra C, sídliště Háje a lesopark s rozhlednou. Metro C na konečné Háje a autobusové spoje do okolí.',
      'Háje patří k cenově nejdostupnějším pražským lokalitám s výbornou dostupností metra. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 11', 'Chodov', 'Opatov', 'Praha 4'],
  },
  'Chodov': {
    title: BASE + 'Chodov bez realitky',
    intro: [
      'Velké sídliště s metrem C na Chodově, obchodním centrem a rozsáhlým lesoparkem.',
      'Chodov nabízí dostupné bydlení s rychlým spojením do centra metrem. Inzeráty přímo od majitelů - bez provize.',
    ],
    nearby: ['Praha 11', 'Háje', 'Opatov', 'Krč'],
  },

  // ── Praha 5 (Stodůlky, Zličín) ──
  'Praha 5': {
    title: 'Pronájem bytu Praha 5 bez realitky',
    intro: [
      'Praha 5 zahrnuje Smíchov, Stodůlky a Zličín, s metrem B přes Anděl po Nové Butovice a Zličín a tramvajemi 4, 7, 12 a 20.',
      'Od rušného Smíchova po klidnější západní části - Praha 5 má bydlení pro každý rozpočet. Norkuj spojuje napřímo s majiteli.',
    ],
    nearby: ['Smíchov', 'Stodůlky', 'Zličín', 'Radlice', 'Malá Strana'],
  },
  'Stodůlky': {
    title: BASE + 'Stodůlky bez realitky',
    intro: [
      'Západní čtvrť s metrem B na Nových Butovicích a Stodůlkách a tramvají 9.',
      'Stodůlky nabízí cenově dostupné bydlení v zeleni s rychlým spojením do centra. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 13', 'Praha 5', 'Zličín', 'Řepy'],
  },
  'Zličín': {
    title: BASE + 'Zličín bez realitky',
    intro: [
      'Konečná stanice metra B a hlavní brána k dálnici D5, s obchodním centrem a rozvíjející se bytovou výstavbou.',
      'Zličín je oblíbený pro dostupnost letiště, dálnice i metra. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 5', 'Stodůlky', 'Řepy', 'Praha 13'],
  },

  // ── Praha 6 (Dejvice, Břevnov, Střešovice, Bubeneč) ──
  'Praha 6': {
    title: 'Pronájem bytu Praha 6 bez realitky',
    intro: [
      'Praha 6 je domovem Dejvic, Břevnova, Střešovic a Bubenče - zelených čtvrtí s metrem A (Dejvická, Bořislavka) a tramvajemi 1, 2, 20, 22 a 26.',
      'Zahradní město s vilami, univerzitami a Dejvickým kampusem. Pronájem bytů přímo od majitelů - bez provize realitky.',
    ],
    nearby: ['Dejvice', 'Břevnov', 'Střešovice', 'Bubeneč', 'Hradčany'],
  },
  'Dejvice': {
    title: BASE + 'Dejvice bez realitky',
    intro: [
      'Univerzitní čtvrť s metrem A na Dejvické a Bořislavce, tramvajemi 1, 2, 20 a 26 a Výstavištěm v sousedství.',
      'Dejvice nabízí klidné a prestižní bydlení blízko centra i parku Stromovka. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 6', 'Bubeneč', 'Střešovice', 'Hradčany', 'Břevnov'],
  },
  'Břevnov': {
    title: BASE + 'Břevnov bez realitky',
    intro: [
      'Klidná čtvrť s Břevnovským klášterem, Markétskou ulicí a tramvajemi 1, 2, 20 a 22.',
      'Břevnov kombinuje vilovou zástavbu s cenově dostupnějšími byty. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 6', 'Střešovice', 'Dejvice', 'Hradčany', 'Řepy'],
  },
  'Střešovice': {
    title: BASE + 'Střešovice bez realitky',
    intro: [
      'Malebná vilová čtvrť s Fidlovačkou, výhledy a tramvají 22 na Hrad.',
      'Střešovice patří k nejžádanějším klidným lokalitám Prahy. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Praha 6', 'Břevnov', 'Dejvice', 'Hradčany'],
  },
  'Bubeneč': {
    title: BASE + 'Bubeneč bez realitky',
    intro: [
      'Elegantní čtvrť kolem Stromovky, Výstaviště a Královské obory. Metro C na Nádraží Holešovice a tramvaje 6, 8, 12, 17 a 26.',
      'Bubeneč je jedna z nejzelenějších adres v Praze, blízko centra i řeky. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 6', 'Praha 7', 'Holešovice', 'Dejvice', 'Troja'],
  },

  // ── Praha 7 (Holešovice, Troja) ──
  'Praha 7': {
    title: 'Pronájem bytu Praha 7 bez realitky',
    intro: [
      'Praha 7 je domovem Holešovic, Bubenče a Troji - čtvrtí kolem Stromovky, Výstaviště a zoo. Metro C na Vltavské a Nádraží Holešovice, tramvaje 6, 12, 17 a 26.',
      'Moderní bydlení v industriálním duchu s parky na dosah. Norkuj spojuje přímo nájemníky s majiteli - bez provize.',
    ],
    nearby: ['Holešovice', 'Bubeneč', 'Troja', 'Karlín', 'Letná'],
  },
  'Troja': {
    title: BASE + 'Troja bez realitky',
    intro: [
      'Zelená čtvrť s Trojským zámkem, botanickou zahradou a pražskou zoo, mezi Vltavou a kopci.',
      'Troja je ideální pro bydlení v přírodě s dostupností do centra. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 7', 'Bubeneč', 'Holešovice', 'Praha 8'],
  },

  // ── Praha 8 (Karlín, Kobylisy, Libeň, Ďáblice) ──
  'Praha 8': {
    title: 'Pronájem bytu Praha 8 bez realitky',
    intro: [
      'Praha 8 zahrnuje Karlín, Libeň, Kobylisy a Ďáblice - od moderních bytů po klidná sídliště. Metro B na Florenci a Palmovce, metro C na Kobylisích a Ládví.',
      'Dostupnost do centra je vynikající díky metru i tramvajím. Pronájem bytů přímo od majitelů - bez provize.',
    ],
    nearby: ['Karlín', 'Libeň', 'Kobylisy', 'Ďáblice', 'Holešovice'],
  },
  'Libeň': {
    title: BASE + 'Libeň bez realitky',
    intro: [
      'Nová Libeň roste kolem Palmovky a náplavky, se starou Libní s vilami u Bulovky. Metro B a C na Palmovce, tramvaje 1, 3, 5, 8 a 24.',
      'Libeň nabízí rozmanité bydlení v dosahu centra i Stromovky. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Praha 8', 'Karlín', 'Kobylisy', 'Holešovice', 'Vysočany'],
  },
  'Kobylisy': {
    title: BASE + 'Kobylisy bez realitky',
    intro: [
      'Klidná čtvrť na kopci s metrem C na Kobylisích a Ládví a tramvajemi 10, 17 a 24.',
      'Kobylisy kombinují vilovou zástavbu s dostupným bydlením a výhledy na Prahu. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 8', 'Libeň', 'Ďáblice', 'Bohnice', 'Holešovice'],
  },
  'Ďáblice': {
    title: BASE + 'Ďáblice bez realitky',
    intro: [
      'Klidná čtvrť na severním okraji Prahy s rodinnými domy a autobusovým spojením na Kobylisy a Ládví.',
      'Ďáblice nabízí bydlení blízko přírody s dostupností do centra. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 8', 'Kobylisy', 'Bohnice', 'Praha 19'],
  },

  // ── Praha 9 (Vysočany, Hloubětín, Prosek) ──
  'Praha 9': {
    title: 'Pronájem bytu Praha 9 bez realitky',
    intro: [
      'Praha 9 je domovem Vysočan, Hloubětína a Proseka - čtvrtí s metrem B (Vysočanská, Českomoravská) a tramvajemi 1, 5, 8, 9 a 25.',
      'Rychle se rozvíjející oblast s moderními kancelářskými i bytovými projekty. Pronájem bytů přímo od majitelů - bez provize.',
    ],
    nearby: ['Vysočany', 'Hloubětín', 'Prosek', 'Libeň', 'Karlín'],
  },
  'Vysočany': {
    title: BASE + 'Vysočany bez realitky',
    intro: [
      'Kancelářská čtvrť s metrem B na Vysočanské a Českomoravské, tramvajemi 1, 5, 8, 9 a 25 a O2 arenou.',
      'Vysočany procházejí velkou proměnou a nabízejí nové byty v dosahu centra. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Praha 9', 'Libeň', 'Karlín', 'Hloubětín', 'Prosek'],
  },
  'Hloubětín': {
    title: BASE + 'Hloubětín bez realitky',
    intro: [
      'Klidnější čtvrť s metrem B na Hloubětíně a tramvajemi 1, 5, 8 a 25, s dostupnými byty a rodinnými domy.',
      'Hloubětín nabízí dobrý poměr ceny a dostupnosti do centra. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 9', 'Praha 14', 'Vysočany', 'Hrdlořezy'],
  },
  'Prosek': {
    title: BASE + 'Prosek bez realitky',
    intro: [
      'Sídliště s metrem C na Proseku a Střížkově a tramvajemi 5, 9 a 25, s rozsáhlým lesoparkem.',
      'Prosek nabízí dostupné bydlení s výbornou dostupností metra. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 9', 'Střížkov', 'Vysočany', 'Letňany'],
  },

  // ── Praha 10 (Vršovice, Strašnice, Malešice) ──
  'Praha 10': {
    title: 'Pronájem bytu Praha 10 bez realitky',
    intro: [
      'Praha 10 zahrnuje Vršovice, Strašnice a Malešice - živé čtvrti s metrem A (Strašnická, Skalka) a tramvajemi 4, 5, 7, 13 a 22.',
      'Od bohémských Vršovic po klidnější Strašnice, Praha 10 nabízí pestrou škálu bydlení. Pronájem přímo od majitelů - bez provize.',
    ],
    nearby: ['Vršovice', 'Strašnice', 'Malešice', 'Vinohrady', 'Záběhlice'],
  },
  'Vršovice': {
    title: BASE + 'Vršovice bez realitky',
    intro: [
      'Bohémská čtvrť s Vršovickým náměstím, Edenem a Kremličkou, s tramvajemi 4, 7, 13 a 22 a metrem A na Náměstí Míru.',
      'Vršovice jsou oblíbené pro svůj stylový život a dostupnost do centra. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Praha 10', 'Vinohrady', 'Strašnice', 'Nusle', 'Praha 2'],
  },
  'Strašnice': {
    title: BASE + 'Strašnice bez realitky',
    intro: [
      'Klidná čtvrť s metrem A na Strašnické a Skalce a tramvajemi 4, 5, 13 a 22.',
      'Strašnice nabízí rozumné ceny a dobrou dostupnost do centra. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 10', 'Vršovice', 'Malešice', 'Vinohrady', 'Záběhlice'],
  },
  'Malešice': {
    title: BASE + 'Malešice bez realitky',
    intro: [
      'Klidná čtvrť na východě Prahy s dostupnými byty a tramvajemi 1, 5, 9 a 26.',
      'Malešice nabízejí bydlení v zeleni s dobrým spojením do centra. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 10', 'Strašnice', 'Hrdlořezy', 'Žižkov'],
  },

  // ── Záběhlice / Michle / others ──
  'Záběhlice': {
    title: BASE + 'Záběhlice bez realitky',
    intro: [
      'Zelená čtvrť mezi Vršovicemi a Hostivaří, podél Botiče a Hamerského rybníka.',
      'Záběhlice nabízejí klidné bydlení blízko přírody. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 10', 'Praha 4', 'Vršovice', 'Hostivař'],
  },
  'Michle': {
    title: BASE + 'Michle bez realitky',
    intro: [
      'Čtvrť na jihu Prahy kolem Jižní spojky, s metrem C na Pražského povstání a tramvajemi 4, 18 a 19.',
      'Michle nabízí dostupné bydlení s dobrou dostupností. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Praha 4', 'Krč', 'Vršovice', 'Nusle'],
  },

  // ── Praha 11-22 (with empty children) ──
  'Praha 11': {
    title: 'Pronájem bytu Praha 11 bez realitky',
    intro: [
      'Jižní Praha 11 s Chodovem, Hájemi a Křeslicemi, s metrem C a rozsáhlým Centrálním parkem.',
      'Cenově dostupné bydlení s výbornou dostupností metrem. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Háje', 'Chodov', 'Křeslice', 'Praha 4'],
  },
  'Praha 12': {
    title: 'Pronájem bytu Praha 12 bez realitky',
    intro: [
      'Modřany a okolní čtvrti v jižní části Prahy podél Vltavy, s tramvajemi 2, 3, 17 a 18.',
      'Bydlení u řeky s klidem a přírodou na dosah. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Modřany', 'Braník', 'Praha 4', 'Libuš'],
  },
  'Praha 13': {
    title: 'Pronájem bytu Praha 13 bez realitky',
    intro: [
      'Západní Praha 13 kolem Nových Butovic a Stodůlek, s metrem B a tramvajemi 9 a 10.',
      'Sídliště s dobrou občanskou vybaveností a rychlým spojením do centra. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Stodůlky', 'Řepy', 'Praha 5', 'Zličín'],
  },
  'Praha 14': {
    title: 'Pronájem bytu Praha 14 bez realitky',
    intro: [
      'Černý Most a Hloubětín na severovýchodě Prahy, s metrem B na Černém Mostě.',
      'Dostupné bydlení s výborným spojením metrem do centra. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Hloubětín', 'Černý Most', 'Praha 9', 'Kbely'],
  },
  'Praha 15': {
    title: 'Pronájem bytu Praha 15 bez realitky',
    intro: [
      'Horní Měcholupy a okolní čtvrti v jihovýchodní části Prahy.',
      'Klidné bydlení s dobrou dostupností do centra. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Horní Měcholupy', 'Petrovice', 'Štěrboholy', 'Hostivař'],
  },
  'Praha 16': {
    title: 'Pronájem bytu Praha 16 bez realitky',
    intro: [
      'Zbraslav, Radotín a okolní čtvrti na jihu Prahy u řeky a přírody.',
      'Bydlení v přírodě s možností parkování a vlastní zahrady. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Zbraslav', 'Radotín', 'Lochkov', 'Praha 5'],
  },
  'Praha 17': {
    title: 'Pronájem bytu Praha 17 bez realitky',
    intro: [
      'Řepy na západě Prahy, s metrem B na Lípě a Stodůlkách a tramvajemi 9 a 10.',
      'Dostupné bydlení v zeleni s rychlým spojením do centra. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Řepy', 'Praha 13', 'Stodůlky', 'Břevnov'],
  },
  'Praha 18': {
    title: 'Pronájem bytu Praha 18 bez realitky',
    intro: [
      'Letňany na severu Prahy, s metrem C na Letňanech a sportovním areálem.',
      'Bydlení na okraji Prahy s dostupností metrem. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Letňany', 'Čakovice', 'Prosek', 'Kbely'],
  },
  'Praha 19': {
    title: 'Pronájem bytu Praha 19 bez realitky',
    intro: [
      'Kbely, Satalice a Vinoř na severovýchodě Prahy, s letištěm Kbely a zelení.',
      'Klidné bydlení s možností parkování. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Kbely', 'Satalice', 'Vinoř', 'Praha 18'],
  },
  'Praha 20': {
    title: 'Pronájem bytu Praha 20 bez realitky',
    intro: [
      'Horní Počernice na východě Prahy, s železniční zastávkou a rozsáhlými parky.',
      'Bydlení v zeleni na okraji Prahy s dobrým spojením. Norkuj tě spojí přímo s majiteli - bez provize.',
    ],
    nearby: ['Horní Počernice', 'Praha 14', 'Praha 21', 'Černý Most'],
  },
  'Praha 21': {
    title: 'Pronájem bytu Praha 21 bez realitky',
    intro: [
      'Újezd nad Lesy a okolní čtvrti na východním okraji Prahy, v klidném přírodním prostředí.',
      'Klidné bydlení u lesa s možností parkování. Pronájem přímo od majitele - bez provize.',
    ],
    nearby: ['Újezd nad Lesy', 'Klánovice', 'Praha 20', 'Černý Most'],
  },
  'Praha 22': {
    title: 'Pronájem bytu Praha 22 bez realitky',
    intro: [
      'Uhříněves a okolní obce na jihovýchodním okraji Prahy.',
      'Bydlení blízko přírody s dobrou dopravou do centra. Najdi si byt přímo od majitele - bez provize.',
    ],
    nearby: ['Uhříněves', 'Benice', 'Kolovraty', 'Praha 10'],
  },
}

export function getDistrictContent(name: string): DistrictContent {
  return DISTRICT_CONTENT[name] ?? {
    title: BASE + name + ' bez realitky',
    intro: [
      'Pronájem bytu ve čtvrti ' + name + ' v Praze. Filtruj podle dostupnosti metra a tramvají a kontaktuj majitele napřímo - bez provize realitky.',
    ],
    nearby: [],
  }
}
