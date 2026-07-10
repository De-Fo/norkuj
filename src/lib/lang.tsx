import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Lang = 'cz' | 'en'

const LangContext = createContext<{
  lang: Lang
  t: (key: string) => string
  setLang: (l: Lang) => void
}>({
  lang: 'cz',
  t: (key: string) => key,
  setLang: () => {},
})

const STORAGE_KEY = 'norkuj-lang'

function getInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'en') return 'en'
  return 'cz'
}

const cs: Record<string, string> = {
  'favorites_title': 'Oblíbené',
  'favorites_empty': 'Zatím nemáš žádné oblíbené inzeráty.',
  'profile': 'Profil',
  'logout': 'Odhlásit',
  'login': 'Přihlásit',
  'register': 'Registrovat',
  'add_listing': '+ Přidat',
  'my_listings': 'Moje inzerce',
  'search_hint': 'Vyber linky, oblasti nebo filtry...',
  'listings_count': 'inzerátů',
  'metro_label': 'Metro',
  'tram_label': 'Tramvaj',
  'district_label': 'Oblast / čtvrť',
  'map_filter_label': '🗺 Filtrovat dle pohybu mapy',
  'filters_label': 'Filtry',
  'hide_label': 'Skrýt',
  'reset_label': '✕ Resetovat vše',
  'green': 'V obou oblastech',
  'yellow': 'Jen v městské části',
  'red': 'Jen na trase linek',
  'grey': 'Ostatní',
  'green_transit_only': 'V dosahu linky',
  'yellow_transit_only': 'Dále od linky',
  'yellow_dist_only': 'V městské části',
  'no_results': 'Žádné inzeráty',
  'no_results_hint': 'Zkus upravit filtry',
  'sort_date': 'Datum',
  'sort_price': 'Cena',
  'sort_area': 'Plocha',
  'iso_label': '📍 Dojezd PID (MHD)',
  'iso_description': 'reálný dosah z libovolného místa pomocí dopravy PID',
  'iso_active': 'klikni na mapu pro výpočet',
  'iso_cancel': '✕ Zrušit',
  'iso_minutes': 'min',
  'iso_loading': '⏳',
  'map_toggle_hide': '🗺 Skrýt mapu',
  'map_toggle_show': '🗺 Zobrazit mapu',
  'mobile_map_btn': '🗺 Mapa',
  'mobile_list_btn': '📋 Seznam',
  'mobile_list_btn_back': '← Seznam',
  'loading': 'Načítám...',
  'no_listings': 'Žádné inzeráty',
  'theme_light': 'Světlý režim',
  'theme_dark': 'Tmavý režim',
  'back_search': 'Zpět na vyhledávání',
  'multi_hint': 'lze vybrat víc',
  'amenities_furnished': '🛋 Zařízený',
  'amenities_pets': '🐾 Zvířata',
  'amenities_parking': '🅿 Parkování',
  'amenities_balcony': '🌿 Balkon',
  'map_legend_both': 'V obou oblastech',
  'map_legend_district': 'Jen v městské části',
  'map_legend_line': 'Jen na trase linek',
  'map_legend_other': 'Ostatní',
  'filter_popup_title': 'Oblast / čtvrť',
  'listing_detail_close': '✕',
  'listing_detail_contact': '📞 Zobrazit kontakt',
  'listing_detail_login_prompt': 'Pro zobrazení kontaktu se přihlas zdarma',
  'listing_detail_login_btn': 'Přihlásit se',
  'listing_detail_location': 'Poloha na mapě',
  '_line': 'linka',
  '_lines': 'linky',
  '_district': 'oblast',
  '_districts': 'oblasti',
  'price_hint': 'Kč',
  'min_area_label': 'Min. plocha',
  'amenities_label': 'Vybavení',
  '_floorplan': 'Dispozice',
  '_rent': 'Nájem',
  '_donate': 'Podpořit',
  '_donate_alert': 'Děkujeme za zájem! Platební brána bude přidána brzy.',
  '_copyright': 'norkuj · 🏡 Najdi své bydlení v Praze',
  '_made_by': 'Made by',
  '_footer_privacy': 'Ochrana osobních údajů',
  '_footer_cookies': 'Cookies',
  '_footer_terms': 'Podmínky služby',
  '_footer_consumer': 'Ochrana spotřebitele',
}

const en: Record<string, string> = {
  'favorites_title': 'Favorites',
  'favorites_empty': 'You don\'t have any favorite listings yet.',
  'profile': 'Profile',
  'logout': 'Log out',
  'login': 'Log in',
  'register': 'Register',
  'add_listing': '+ Add',
  'my_listings': 'My listings',
  'search_hint': 'Select lines, areas or filters...',
  'listings_count': 'listings',
  'metro_label': 'Metro',
  'tram_label': 'Tram',
  'district_label': 'District / quarter',
  'map_filter_label': '🗺 Filter by map view',
  'filters_label': 'Filters',
  'hide_label': 'Hide',
  'reset_label': '✕ Reset all',
  'green': 'In both areas',
  'yellow': 'In district only',
  'red': 'Near transit line only',
  'grey': 'Other',
  'green_transit_only': 'Near transit line',
  'yellow_transit_only': 'Further from line',
  'yellow_dist_only': 'In district',
  'no_results': 'No listings',
  'no_results_hint': 'Try adjusting filters',
  'sort_date': 'Date',
  'sort_price': 'Price',
  'sort_area': 'Area',
  'iso_label': '📍 Transit reach (PID)',
  'iso_description': 'reachable area via public transit',
  'iso_active': 'click on map to calculate',
  'iso_cancel': '✕ Cancel',
  'iso_minutes': 'min',
  'iso_loading': '⏳',
  'map_toggle_hide': '🗺 Hide map',
  'map_toggle_show': '🗺 Show map',
  'mobile_map_btn': '🗺 Map',
  'mobile_list_btn': '📋 List',
  'mobile_list_btn_back': '← List',
  'loading': 'Loading...',
  'no_listings': 'No listings',
  'theme_light': 'Light mode',
  'theme_dark': 'Dark mode',
  'back_search': 'Back to search',
  'multi_hint': 'select multiple',
  'amenities_furnished': '🛋 Furnished',
  'amenities_pets': '🐾 Pets OK',
  'amenities_parking': '🅿 Parking',
  'amenities_balcony': '🌿 Balcony',
  'map_legend_both': 'In both areas',
  'map_legend_district': 'In district only',
  'map_legend_line': 'Near transit line only',
  'map_legend_other': 'Other',
  'filter_popup_title': 'District / quarter',
  'listing_detail_close': '✕',
  'listing_detail_contact': '📞 Show contact',
  'listing_detail_login_prompt': 'Sign in for free to see contact',
  'listing_detail_login_btn': 'Sign in',
  'listing_detail_location': 'Location on map',
  '_line': 'line',
  '_lines': 'lines',
  '_district': 'area',
  '_districts': 'areas',
  'price_hint': 'CZK',
  'min_area_label': 'Min. area',
  'amenities_label': 'Amenities',
  '_floorplan': 'Layout',
  '_rent': 'Rent',
  '_donate': 'Support',
  '_donate_alert': 'Thank you for your interest! Payment gateway will be added soon.',
  '_copyright': 'norkuj · 🏡 Find your home in Prague',
  '_made_by': 'Made by',
  '_footer_privacy': 'Privacy Policy',
  '_footer_cookies': 'Cookies',
  '_footer_terms': 'Terms of Service',
  '_footer_consumer': 'Consumer Protection',
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang)

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  const t = (key: string): string => {
    const dict = lang === 'en' ? en : cs
    return dict[key] ?? key
  }

  return (
    <LangContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
