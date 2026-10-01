"""
pairings.py - Pairing rules, scoring weights, keyword vocabularies, and city drink matching.
"""

import re

# 14 Flavor Families Keyword Dictionary
FLAVOR_FAMILIES = {
    "citrus": [
        "lemon", "lime", "orange", "grapefruit", "yuzu", "bergamot", "triple sec",
        "cointreau", "curacao", "citrus", "peel", "zest", "kumquat", "tangerine",
        "clementine", "limoncello", "mandarin", "bitter orange", "sour mix"
    ],
    "bitter": [
        "campari", "aperol", "amaro", "bitters", "angostura", "fernet", "gentian",
        "cynar", "suze", "averna", "montenegro", "nonino", "peychaud", "bitter"
    ],
    "herbal": [
        "chartreuse", "vermouth", "absinthe", "mint", "rosemary", "basil", "thyme",
        "sage", "coriander", "benedictine", "anise", "anis", "fennel", "dill",
        "tarragon", "oregano", "lavender", "pastis", "pernod", "galliano",
        "strega", "sambuca", "herbal"
    ],
    "coffee & chocolate": [
        "coffee", "espresso", "kahlua", "cacao", "chocolate", "tia maria", "mocha",
        "cocoa", "creme de cacao", "cold brew", "coffee liqueur"
    ],
    "creamy": [
        "cream", "heavy cream", "half-and-half", "milk", "baileys", "irish cream",
        "egg", "egg white", "egg yolk", "yogurt", "coconut cream", "condensed milk",
        "orgeat", "butter", "advocaat"
    ],
    "tropical": [
        "pineapple", "coconut", "passion fruit", "mango", "guava", "papaya",
        "banana", "kiwi", "falernum", "tiki", "creme de banane", "blue curacao"
    ],
    "berry": [
        "raspberry", "blackberry", "strawberry", "blueberry", "cranberry", "cassis",
        "creme de cassis", "grenadine", "chambord", "sloe gin", "blackcurrant",
        "redcurrant", "berry"
    ],
    "stone fruit": [
        "peach", "apricot", "plum", "cherry", "maraschino", "kirsch", "nectarine",
        "amaretto", "peche", "cherry heering", "luxardo"
    ],
    "apple & pear": [
        "apple", "cider", "calvados", "applejack", "pear", "poire",
        "apple schnapps", "pear liqueur", "apple brandy"
    ],
    "smoky": [
        "mezcal", "islay", "peated", "smoked", "chipotle", "laphroaig",
        "lagavulin", "ardbeg", "smoke"
    ],
    "spicy": [
        "ginger", "chili", "chile", "jalapeno", "pepper", "tabasco", "cinnamon",
        "clove", "nutmeg", "allspice", "pimento", "cardamom", "peppercorn",
        "ancho reyes", "firewater", "cayenne", "habanero"
    ],
    "sparkling": [
        "champagne", "prosecco", "cava", "sparkling wine", "club soda", "soda water",
        "tonic", "ginger beer", "ginger ale", "seltzer", "sparkling", "effervescent"
    ],
    "sweet & syrupy": [
        "simple syrup", "honey", "agave", "maple", "demerara", "sugar",
        "molasses", "caramel", "vanilla", "syrup", "cane syrup", "gomme"
    ],
    "floral": [
        "elderflower", "st germain", "st. germain", "rose", "violet",
        "creme de violette", "lavender", "hibiscus", "chamomile",
        "orange blossom", "lillet", "lillet blanc", "lillet rouge"
    ]
}

# Claimed birthplaces only (Report any not found by name; add no others)
BORN_HERE = {
    "New Orleans, LA": ["Sazerac", "Ramos Gin Fizz", "Vieux Carré", "Hurricane"],
    "New York, NY": ["Manhattan"],
    "Philadelphia, PA": ["Clover Club"],
    "Boston, MA": ["Ward Eight"],
    "Washington, DC": ["Gin Rickey"],
    "Detroit, MI": ["Last Word"],
    "Louisville, KY": ["Old Fashioned"],
    "San Francisco, CA": ["Pisco Punch", "Irish Coffee"],
    "Oakland, CA": ["Mai Tai"]
}

# State-level birthplace for Wisconsin
BORN_HERE_STATE = {
    "Wisconsin": ["Brandy Old Fashioned"],
    "WI": ["Brandy Old Fashioned"]
}

# State signature ingredients
STATE_SIGNATURES = {
    "Georgia": ["peach"], "GA": ["peach"],
    "Florida": ["orange", "citrus"], "FL": ["orange", "citrus"],
    "Texas": ["grapefruit"], "TX": ["grapefruit"],
    "Vermont": ["maple"], "VT": ["maple"],
    "Washington": ["apple"], "WA": ["apple"],
    "Michigan": ["cherry"], "MI": ["cherry"],
    "Maine": ["blueberry"], "ME": ["blueberry"],
    "Wisconsin": ["cranberry"], "WI": ["cranberry"],
    "Massachusetts": ["cranberry"], "MA": ["cranberry"],
    "Hawaii": ["pineapple"], "HI": ["pineapple"],
    "Kentucky": ["bourbon", "mint"], "KY": ["bourbon", "mint"],
    "New Mexico": ["chile", "chili"], "NM": ["chile", "chili"],
    "Oregon": ["hazelnut", "pear"], "OR": ["hazelnut", "pear"]
}

# Regional mapping for all 50 states plus DC
REGION_BY_STATE = {
    # Pacific Northwest
    "WA": "Pacific Northwest", "Washington": "Pacific Northwest",
    "OR": "Pacific Northwest", "Oregon": "Pacific Northwest",
    "ID": "Pacific Northwest", "Idaho": "Pacific Northwest",
    "AK": "Pacific Northwest", "Alaska": "Pacific Northwest",

    # California
    "CA": "California", "California": "California",

    # Southwest
    "AZ": "Southwest", "Arizona": "Southwest",
    "NM": "Southwest", "New Mexico": "Southwest",
    "NV": "Southwest", "Nevada": "Southwest",
    "UT": "Southwest", "Utah": "Southwest",

    # Mountain West
    "CO": "Mountain West", "Colorado": "Mountain West",
    "MT": "Mountain West", "Montana": "Mountain West",
    "WY": "Mountain West", "Wyoming": "Mountain West",

    # Midwest
    "IL": "Midwest", "Illinois": "Midwest",
    "IN": "Midwest", "Indiana": "Midwest",
    "IA": "Midwest", "Iowa": "Midwest",
    "KS": "Midwest", "Kansas": "Midwest",
    "MI": "Midwest", "Michigan": "Midwest",
    "MN": "Midwest", "Minnesota": "Midwest",
    "MO": "Midwest", "Missouri": "Midwest",
    "NE": "Midwest", "Nebraska": "Midwest",
    "ND": "Midwest", "North Dakota": "Midwest",
    "OH": "Midwest", "Ohio": "Midwest",
    "SD": "Midwest", "South Dakota": "Midwest",
    "WI": "Midwest", "Wisconsin": "Midwest",

    # South
    "AL": "South", "Alabama": "South",
    "AR": "South", "Arkansas": "South",
    "FL": "South", "Florida": "South",
    "GA": "South", "Georgia": "South",
    "KY": "South", "Kentucky": "South",
    "LA": "South", "Louisiana": "South",
    "MS": "South", "Mississippi": "South",
    "NC": "South", "North Carolina": "South",
    "OK": "South", "Oklahoma": "South",
    "SC": "South", "South Carolina": "South",
    "TN": "South", "Tennessee": "South",
    "TX": "South", "Texas": "South",
    "VA": "South", "Virginia": "South",
    "WV": "South", "West Virginia": "South",

    # Northeast
    "CT": "Northeast", "Connecticut": "Northeast",
    "DE": "Northeast", "Delaware": "Northeast",
    "ME": "Northeast", "Maine": "Northeast",
    "MD": "Northeast", "Maryland": "Northeast",
    "MA": "Northeast", "Massachusetts": "Northeast",
    "NH": "Northeast", "New Hampshire": "Northeast",
    "NJ": "Northeast", "New Jersey": "Northeast",
    "NY": "Northeast", "New York": "Northeast",
    "PA": "Northeast", "Pennsylvania": "Northeast",
    "RI": "Northeast", "Rhode Island": "Northeast",
    "VT": "Northeast", "Vermont": "Northeast",
    "DC": "Northeast", "District of Columbia": "Northeast"
}

# Regional Flavor Profiles
REGIONAL_PROFILES = {
    "South": {
        "base": "bourbon",
        "flavors": ["stone fruit", "herbal"]
    },
    "Mountain West": {
        "base": "rye",
        "flavors": ["herbal", "spicy"]
    },
    "Northeast": {
        "base": "gin",
        "flavors": ["bitter", "citrus"]
    },
    "Southwest": {
        "base": "tequila",
        "flavors": ["smoky", "spicy", "citrus"]
    },
    "Midwest": {
        "base": "brandy",
        "flavors": ["sweet & syrupy", "berry"]
    },
    "California": {
        "base": "rum",
        "flavors": ["tropical", "citrus"]
    },
    "Pacific Northwest": {
        "base": "any",
        "flavors": ["coffee & chocolate", "herbal", "apple & pear"]
    }
}

# False positives to remove in Layer 2 (Named after here)
FALSE_POSITIVES = {
    "george washington": "Refers to historical person, not city or state",
    "martha washington": "Refers to historical person, not city or state",
    "tom collins": "Refers to hoax/person, not Fort Collins",
    "john collins": "Refers to person, not Fort Collins",
    "alexander": "Refers to person, not Alexandria",
    "bellini": "Refers to Venetian painter, not place",
    "jack rose": "Refers to gambler or rose color, not place",
    "rob roy": "Refers to Scottish folk hero, not place",
    "harvey wallbanger": "Refers to surfer, not place",
    "mary pickford": "Refers to actress, not place",
    "charlie chaplin": "Refers to actor, not place",
    "bloody mary": "Refers to monarch, not place",
    "gibson": "Refers to illustrator Charles Dana Gibson, not place",
    "virgin": "Refers to non-alcoholic, not Virginia",
    "orange": "Refers to citrus fruit, not Orange County or city",
    "reading": "Refers to the verb reading or Reading UK, not Reading PA",
    "mobile": "Refers to motion/mobile phone, not Mobile AL",
    "independence": "Refers to concept of independence, not Independence MO",
    "liberty": "Refers to concept of liberty, not Liberty city",
    "phoenix": "Refers to mythical bird unless explicitly Phoenix cocktail",
    "green": "Refers to color, not Green Bay or Bowling Green",
    "concord": "Refers to concord grape, not Concord NH",
    "aurora": "Refers to aurora borealis or Roman goddess, not Aurora CO/IL",
    "sterling": "Refers to silver/currency, not Sterling city",
    "florence": "Refers to Florence Italy, not Florence AL"
}

# SCORING WEIGHTS
# Put in pairings.py so they are easy to adjust.
# Regional profile is explicitly the smallest location weight (12 < 30 < 40 < 55)
WEIGHTS = {
    # Location weights
    "born_here": 55,
    "named_after": 40,
    "state_signature": 30,
    "regional_profile": 12,

    # Weather weights
    "weather_cold_hot": 32,
    "weather_cold_stirred": 22,
    "weather_mild_sour": 25,
    "weather_hot_frozen": 32,
    "weather_hot_long_sparkling": 25,
    "weather_rain_snow": 26,
    "weather_humidity_long": 20
}

def is_long_drink(drink):
    """Determine if a drink is tall/long based on glass or categories."""
    glass = (drink.get("glass") or "").lower()
    cats = [c.lower() for c in (drink.get("categories") or [])]
    return "highball" in glass or "collins" in glass or "long" in cats or "tall" in glass

def score_drink_for_city(drink, city, state_name, state_code, weather=None):
    """
    Score a single drink for a given city and live/sample weather.
    Returns: (total_score, best_reason, is_location_reason, is_weather_reason)
    """
    city_clean = (city or "").strip()
    state_clean = (state_name or "").strip()
    st_code = state_code or state_clean
    city_label = f"{city_clean}, {st_code}"

    d_name = drink.get("name", "")
    d_name_lower = d_name.lower()
    d_slug = drink.get("slug", "")
    d_base = (drink.get("base") or "").lower()
    d_method = (drink.get("method") or "").lower()
    d_style = (drink.get("style") or "").lower()
    d_temp = drink.get("serving_temp_c", 10.0)
    d_abv = drink.get("abv") or 0
    d_flavors = set(drink.get("flavor_families") or [])
    d_is_long = drink.get("is_long", False)
    d_cats = set(c.lower() for c in (drink.get("categories") or []))

    rules_fired = [] # list of (score, reason, is_location, is_weather)

    # ----------------- 1. LOCATION RULES -----------------
    # A. Born here (claimed birthplaces only)
    born_drinks = BORN_HERE.get(city_label, [])
    state_born_drinks = BORN_HERE_STATE.get(state_clean, []) + BORN_HERE_STATE.get(st_code, [])

    if any(b.lower() == d_name_lower or b.lower().replace(" ", "_") == d_slug for b in born_drinks):
        rules_fired.append((WEIGHTS["born_here"], f"Claimed to be born in {city_clean}.", True, False))
    elif any(b.lower() == d_name_lower or b.lower().replace(" ", "_") == d_slug for b in state_born_drinks):
        rules_fired.append((WEIGHTS["born_here"], f"Claimed to be born in {state_clean}.", True, False))

    # B. Named after here
    is_false_pos = any(re.search(r'\b' + re.escape(fp) + r'\b', d_name_lower) for fp in FALSE_POSITIVES)
    if not is_false_pos:
        if len(city_clean) > 3 and re.search(r'\b' + re.escape(city_clean.lower()) + r'\b', d_name_lower):
            rules_fired.append((WEIGHTS["named_after"], f"Named for {city_clean}.", True, False))
        elif len(state_clean) > 3 and re.search(r'\b' + re.escape(state_clean.lower()) + r'\b', d_name_lower):
            rules_fired.append((WEIGHTS["named_after"], f"Named for {state_clean}.", True, False))
        else:
            for place_word in ["Manhattan", "Brooklyn", "Bronx", "Hollywood", "Harlem"]:
                if re.search(r'\b' + re.escape(place_word.lower()) + r'\b', d_name_lower):
                    if (place_word in ["Manhattan", "Brooklyn", "Bronx", "Harlem"] and city_clean in ["New York", "Brooklyn"]) or \
                       (place_word == "Hollywood" and city_clean in ["Los Angeles", "Hollywood"]):
                        rules_fired.append((WEIGHTS["named_after"], f"Named for {place_word}.", True, False))
                        break

    # C. State signature ingredient
    state_sigs = STATE_SIGNATURES.get(state_clean, []) or STATE_SIGNATURES.get(st_code, [])
    if state_sigs:
        ing_text = " ".join(f"{i['name']} {i['key']}" for i in drink.get("ingredients", [])).lower()
        matched_sig = None
        for sig in state_sigs:
            if re.search(r'\b' + re.escape(sig) + r'\b', ing_text):
                matched_sig = sig
                break
        if matched_sig:
            rules_fired.append((WEIGHTS["state_signature"], f"Made with {state_clean}'s {matched_sig}.", True, False))

    # D. Regional profile (smallest location weight)
    region_name = REGION_BY_STATE.get(st_code) or REGION_BY_STATE.get(state_clean)
    if region_name and region_name in REGIONAL_PROFILES:
        profile = REGIONAL_PROFILES[region_name]
        req_base = profile["base"]
        req_flavors = set(profile["flavors"])
        
        base_match = (req_base == "any" or req_base in d_base or (req_base == "bourbon" and "whiskey" in d_base) or (req_base == "rye" and "whiskey" in d_base))
        flavor_match = bool(req_flavors.intersection(d_flavors))
        
        if base_match and flavor_match:
            rules_fired.append((WEIGHTS["regional_profile"], f"A {region_name} favorite.", True, False))

    # ----------------- 2. WEATHER RULES -----------------
    if weather and "temp_f" in weather:
        temp_f = float(weather["temp_f"])
        cond = (weather.get("condition") or "").lower()
        hum = float(weather.get("humidity") or 50)
        temp_round = int(round(temp_f))

        # Condition checks: Rain or Snow
        is_rain = any(k in cond for k in ["rain", "drizzle", "shower", "thunderstorm"])
        is_snow = any(k in cond for k in ["snow", "blizzard", "sleet", "ice pellets"])

        if is_rain and (d_method == "stirred" or d_temp > 30.0 or "hot" in d_cats):
            rules_fired.append((WEIGHTS["weather_rain_snow"], f"Rainy and {temp_round}°F.", False, True))
        elif is_snow and (d_method == "stirred" or d_temp > 30.0 or "hot" in d_cats):
            rules_fired.append((WEIGHTS["weather_rain_snow"], f"Snowy and {temp_round}°F.", False, True))

        # Temperature bands
        if temp_f < 50.0:
            if d_temp > 30.0 or "hot" in d_cats:
                rules_fired.append((WEIGHTS["weather_cold_hot"], f"It's {temp_round}°F in {city_clean}. Something warm.", False, True))
            elif d_method == "stirred" and d_abv >= 18:
                rules_fired.append((WEIGHTS["weather_cold_stirred"], f"It's {temp_round}°F in {city_clean}. Something warm.", False, True))
        elif 50.0 <= temp_f <= 80.0:
            if "sour" in d_style or (d_method == "shaken" and "citrus" in d_flavors):
                rules_fired.append((WEIGHTS["weather_mild_sour"], f"A mild {temp_round}°F night.", False, True))
        else: # temp_f > 80.0
            if d_method == "blended" or d_temp <= -3.0:
                rules_fired.append((WEIGHTS["weather_hot_frozen"], f"It's {temp_round}°F. Something cold and long.", False, True))
            elif d_is_long or "sparkling" in d_flavors or "citrus" in d_flavors:
                rules_fired.append((WEIGHTS["weather_hot_long_sparkling"], f"It's {temp_round}°F. Something cold and long.", False, True))

        # Humidity > 70%: favor long drinks with ice and sparkling drinks
        if hum > 70.0 and (d_is_long or "sparkling" in d_flavors):
            rules_fired.append((WEIGHTS["weather_humidity_long"], f"Humid and {temp_round}°F.", False, True))

    total_score = sum(r[0] for r in rules_fired)

    if rules_fired:
        # Whichever rule added the most to its score determines its single reason line
        best_rule = max(rules_fired, key=lambda x: x[0])
        best_reason = best_rule[1]
        is_loc_reason = best_rule[2]
        is_wth_reason = best_rule[3]
    else:
        best_reason = "A classic bar selection."
        is_loc_reason = False
        is_wth_reason = False

    return total_score, best_reason, is_loc_reason, is_wth_reason

def match_drinks_for_city(cocktails, city, state_name, state_code=None, weather=None, top_n=6):
    """
    Select top 6 cocktails for a city, combining location and weather.
    Ensures at least one location match and at least one weather match when both exist,
    and never shows duplicate drink names.
    """
    scored = []
    seen_names = set()

    for c in cocktails:
        score, reason, is_loc_r, is_wth_r = score_drink_for_city(c, city, state_name, state_code, weather)
        scored.append({
            "drink": c,
            "score": score,
            "reason": reason,
            "is_loc_reason": is_loc_r,
            "is_wth_reason": is_wth_r
        })

    # Sort descending by total score
    scored.sort(key=lambda x: x["score"], reverse=True)

    has_loc = any(s["is_loc_reason"] for s in scored)
    has_wth = any(s["is_wth_reason"] for s in scored)

    chosen = []

    # 1. Guarantee top location match if exists
    if has_loc:
        for s in scored:
            if s["is_loc_reason"] and s["drink"]["name"] not in seen_names:
                chosen.append(s)
                seen_names.add(s["drink"]["name"])
                break

    # 2. Guarantee top weather match if exists
    if has_wth:
        for s in scored:
            if s["is_wth_reason"] and s["drink"]["name"] not in seen_names:
                chosen.append(s)
                seen_names.add(s["drink"]["name"])
                break

    # 3. Fill remaining slots up to top_n from overall top scored
    for s in scored:
        if len(chosen) >= top_n:
            break
        if s["drink"]["name"] not in seen_names:
            chosen.append(s)
            seen_names.add(s["drink"]["name"])

    return chosen
