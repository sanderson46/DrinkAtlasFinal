#!/usr/bin/env python3
"""
fetch_data.py - Fetch and cache US breweries from Open Brewery DB and cocktails from 24cocktails.com,
compute derived fields (including is_long), generate place matches, and print sample city menus.
"""

import os
import sys
import json
import re
import time
import argparse
from collections import Counter, defaultdict

# Import pairing definitions and vocabularies
from pairings import (
    FLAVOR_FAMILIES,
    BORN_HERE,
    BORN_HERE_STATE,
    STATE_SIGNATURES,
    REGION_BY_STATE,
    REGIONAL_PROFILES,
    FALSE_POSITIVES,
    is_long_drink,
    match_drinks_for_city
)

# State name to 2-letter postal code mapping
US_STATES = {
    "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
    "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
    "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
    "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
    "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
    "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
    "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
    "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
    "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
    "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
    "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
    "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
    "Wisconsin": "WI", "Wyoming": "WY", "District of Columbia": "DC"
}

STATE_CODE_TO_NAME = {v: k for k, v in US_STATES.items()}

SPECIAL_PLACE_WORDS = {
    "Manhattan": {"city": "New York", "state": "New York", "label": "New York, NY"},
    "Brooklyn": {"city": "New York", "state": "New York", "label": "New York, NY"},
    "Bronx": {"city": "New York", "state": "New York", "label": "New York, NY"},
    "Queens": {"city": "New York", "state": "New York", "label": "New York, NY"},
    "Harlem": {"city": "New York", "state": "New York", "label": "New York, NY"},
    "Hollywood": {"city": "Los Angeles", "state": "California", "label": "Los Angeles, CA"}
}

def format_city_label(city, state):
    clean_city = (city or "").strip()
    clean_state = (state or "").strip()
    st = US_STATES.get(clean_state, clean_state)
    return f"{clean_city}, {st}" if st else clean_city

def fetch_breweries(cache_path, refresh=False):
    """Fetch breweries from Open Brewery DB or load from cache."""
    if os.path.exists(cache_path) and not refresh:
        print(f"Loading cached breweries from {cache_path}...")
        with open(cache_path, "r", encoding="utf-8") as f:
            breweries = json.load(f)
        print(f"Loaded {len(breweries)} breweries from cache.")
        return breweries

    import requests
    print("Fetching fresh breweries from Open Brewery DB...")
    base_url = "https://api.openbrewerydb.org/v1/breweries"
    page = 1
    breweries = []

    while True:
        params = {
            "by_country": "united_states",
            "per_page": 200,
            "page": page
        }
        try:
            resp = requests.get(base_url, params=params, timeout=15)
            if resp.status_code != 200:
                print(f"Error fetching page {page}: HTTP {resp.status_code}")
                break
            batch = resp.json()
            if not batch:
                break
            
            for b in batch:
                lat = b.get("latitude")
                lon = b.get("longitude")
                if lat is None or lon is None:
                    continue
                try:
                    lat_f = float(lat)
                    lon_f = float(lon)
                except (ValueError, TypeError):
                    continue
                
                breweries.append({
                    "name": (b.get("name") or "").strip(),
                    "brewery_type": (b.get("brewery_type") or "other").strip().lower(),
                    "city": (b.get("city") or "").strip(),
                    "state": (b.get("state") or "").strip(),
                    "latitude": lat_f,
                    "longitude": lon_f
                })

            print(f"  Page {page}: {len(batch)} fetched (valid: {len(breweries)})")
            page += 1
            time.sleep(0.1)
        except Exception as e:
            print(f"Exception on page {page}: {e}")
            break

    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(breweries, f, indent=2)
    print(f"Saved {len(breweries)} breweries to {cache_path}.")
    return breweries

ING_UNIT_PATTERN = re.compile(
    r'^(.*?)(?:\s+(\d+(?:\.\d+)?|\d+/\d+|\d+\s+\d+/\d+)\s*(ml|cl|oz|dash(?:es)?|drop(?:s)?|tsp|tbsp|bar\s*spoon|barspoon|part(?:s)?|splash(?:es)?|slice(?:s)?|wedge(?:s)?|sprig(?:s)?|leaves|leaf|pcs|pieces|pinch(?:es)?|cube(?:s)?|can|bottle|top\s*up)?(\s*\(.*?\))?)$',
    re.IGNORECASE
)

def parse_ingredient_line(raw_ing):
    if isinstance(raw_ing, dict):
        name = raw_ing.get("name", "")
        amount = raw_ing.get("amount", "")
        ml = raw_ing.get("ml")
        key = raw_ing.get("key") or re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
        return {"name": name, "amount": amount, "ml": ml, "key": key}

    s = str(raw_ing).strip()
    m = ING_UNIT_PATTERN.match(s)
    if m:
        name = m.group(1).strip()
        num_str = m.group(2)
        unit = (m.group(3) or "").strip().lower()
        extra = m.group(4) or ""
        amount = f"{num_str} {unit}{extra}".strip()
        ml = None
        try:
            if "/" in num_str:
                parts = num_str.split()
                val = float(parts[0]) + eval(parts[1]) if len(parts) == 2 else eval(num_str)
            else:
                val = float(num_str)
            
            if "ml" in unit: ml = round(val, 1)
            elif "cl" in unit: ml = round(val * 10, 1)
            elif "oz" in unit: ml = round(val * 29.5735, 1)
            elif "dash" in unit: ml = round(val * 0.8, 1)
            elif "drop" in unit: ml = round(val * 0.05, 2)
            elif "tsp" in unit or "spoon" in unit: ml = round(val * 5.0, 1)
            elif "tbsp" in unit: ml = round(val * 15.0, 1)
        except Exception:
            pass
    else:
        name = s
        amount = ""
        ml = None
    
    clean_key = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')
    return {"name": name, "amount": amount, "ml": ml, "key": clean_key}

def determine_ice(glass, method, garnish, name, ingredients_str):
    combined = f"{glass} {method} {garnish} {name} {ingredients_str}".lower()
    if method == "blended" or "tiki" in combined or "crushed" in combined:
        return "Crushed"
    if "hot" in combined:
        return "None"
    if any(k in combined for k in ["large cube", "big cube", "block", "chunk"]):
        return "Large cube"
    coupe_martini = ["coupe", "martini", "flute", "nick & nora", "nick and nora", "shot", "glencairn", "snifter"]
    if any(k in glass.lower() for k in coupe_martini):
        return "None"
    if any(k in glass.lower() for k in ["rocks", "old fashioned", "lowball", "tumbler"]):
        return "Large cube" if method == "stirred" else "Cubes"
    return "Cubes"

def estimate_serving_temp(method, abv, categories, name):
    cats_str = " ".join(categories).lower() if categories else ""
    if "hot" in cats_str or "hot" in name.lower():
        return 65.0
    
    m = (method or "").strip().lower()
    val_abv = float(abv) if abv is not None else 15.0
    
    if m == "blended":
        return -3.0
    elif m == "built" or "built" in m:
        return 2.0
    elif m == "shaken" or "shake" in m:
        fraction = min(max(val_abv, 0.0), 40.0) / 40.0
        return round(-8.0 + fraction * 3.0, 1)
    elif m == "stirred" or "stir" in m:
        fraction = min(max(val_abv, 0.0), 45.0) / 45.0
        return round(-5.0 + fraction * 5.0, 1)
    else:
        return 10.0

def extract_flavor_families(ing_list):
    text_corpus = " ".join(f"{ing['name']} {ing['key']}" for ing in ing_list).lower()
    matched = []
    for family, keywords in FLAVOR_FAMILIES.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', text_corpus):
                matched.append(family)
                break
    return matched

def determine_style(base, categories, method, flavor_families, ing_count):
    clean_base = (base or "spirit").lower()
    m = (method or "").lower()
    cats = [c.lower() for c in (categories or [])]

    if "tiki" in cats or (clean_base == "rum" and any(f in flavor_families for f in ["tropical", "citrus"]) and ing_count >= 4):
        return f"{clean_base} tiki"
    elif "sour" in cats or ("citrus" in flavor_families and ("shaken" in m or m == "shake")):
        return f"{clean_base} sour"
    elif "sparkling" in cats or "sparkling" in flavor_families:
        return "sparkling aperitif" if "aperitif" in cats else f"sparkling {clean_base}"
    elif "hot" in cats:
        return f"hot {clean_base}"
    elif "stirred" in m:
        return f"stirred {clean_base}"
    elif "shaken" in m:
        return f"shaken {clean_base}"
    elif "built" in m:
        return f"built {clean_base}"
    elif "blended" in m:
        return f"blended {clean_base}"
    else:
        return f"classic {clean_base}"

def fetch_cocktails(cache_path, refresh=False):
    """Download bulk recipes.jsonl from 24cocktails, parse fields, and compute derived fields."""
    if os.path.exists(cache_path) and not refresh:
        print(f"Loading cached cocktails from {cache_path}...")
        with open(cache_path, "r", encoding="utf-8") as f:
            cocktails = json.load(f)
        print(f"Loaded {len(cocktails)} cocktails from cache.")
        return cocktails

    import requests
    print("Downloading recipes.jsonl from 24cocktails.com...")
    url = "https://24cocktails.com/llms/recipes.jsonl"
    resp = requests.get(url, stream=True, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Failed to download recipes: HTTP {resp.status_code}")

    cocktails = []
    for line in resp.iter_lines():
        if not line:
            continue
        record = json.loads(line.decode("utf-8"))

        name = (record.get("name") or "").strip()
        url_field = (record.get("url") or "").strip()
        slug = record.get("slug") or url_field.rstrip("/").split("/")[-1].split("?")[0]
        base = (record.get("base") or "na").strip().lower()
        
        abv = record.get("abv")
        if abv is not None:
            try:
                abv = float(abv)
            except (ValueError, TypeError):
                abv = None

        if abv is None:
            strength = "n/a"
        elif abv == 0:
            strength = "0%" if base == "na" else "n/a"
        else:
            strength = f"{int(round(abv))}%"

        raw_ingredients = record.get("ingredients") or []
        ingredients = [parse_ingredient_line(ing) for ing in raw_ingredients]
        ingredient_count = len(ingredients)

        method = (record.get("method") or "other").strip().lower()
        glass = (record.get("glass") or "Glass").strip()
        garnish = (record.get("garnish") or "").strip()
        
        categories = record.get("categories") or record.get("cats") or []
        if not categories:
            categories = []
            if "sour" in name.lower(): categories.append("sour")
            if "tiki" in name.lower() or "tiki" in glass.lower(): categories.append("tiki")
            if "hot" in name.lower(): categories.append("hot")
            if any(k in name.lower() for k in ["fizz", "spritz", "collins"]): categories.append("sparkling")

        ice = record.get("ice") or determine_ice(glass, method, garnish, name, str(raw_ingredients))
        difficulty = record.get("difficulty") or (1 if ingredient_count <= 3 else (2 if ingredient_count <= 5 else 3))
        
        prep_minutes = record.get("prep_minutes")
        if prep_minutes is None:
            if method == "built": prep_minutes = 2
            elif method == "stirred": prep_minutes = 3
            elif method == "shaken": prep_minutes = 4
            elif method == "blended": prep_minutes = 5
            else: prep_minutes = 3

        steps = record.get("steps")
        if not steps:
            if method == "stirred":
                steps = [
                    "Add all ingredients to a mixing glass filled with ice.",
                    "Stir thoroughly until chilled and properly diluted.",
                    f"Strain into a {glass}."
                ]
            elif method == "shaken":
                steps = [
                    "Combine all ingredients in a cocktail shaker filled with ice.",
                    "Shake vigorously for 10-15 seconds.",
                    f"Strain into a {glass}."
                ]
            elif method == "blended":
                steps = [
                    "Add all ingredients along with crushed ice into a blender.",
                    "Blend on high until smooth.",
                    f"Pour into a {glass}."
                ]
            else:
                steps = [
                    f"Add ingredients directly to a {glass}.",
                    "Gently stir to combine."
                ]

        photo = record.get("photo") or f"https://24cocktails.com/photo_web/{slug}.jpg"
        serving_temp_c = estimate_serving_temp(method, abv, categories, name)
        flavor_families = extract_flavor_families(ingredients)
        style = determine_style(base, categories, method, flavor_families, ingredient_count)

        # Derived field: is_long
        # true if the glass or categories indicate a tall or long drink (highball, collins, "long")
        glass_lower = glass.lower()
        is_long = ("highball" in glass_lower or "collins" in glass_lower or "long" in categories or "tall" in glass_lower)

        cocktails.append({
            "slug": slug,
            "name": name,
            "base": base,
            "abv": abv,
            "strength": strength,
            "difficulty": difficulty,
            "prep_minutes": prep_minutes,
            "method": method,
            "glass": glass,
            "ice": ice,
            "categories": categories,
            "ingredients": ingredients,
            "ingredient_count": ingredient_count,
            "steps": steps,
            "url": url_field,
            "photo": photo,
            "serving_temp_c": serving_temp_c,
            "flavor_families": flavor_families,
            "style": style,
            "is_long": is_long
        })

    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(cocktails, f, indent=2)
    print(f"Saved {len(cocktails)} processed cocktails to {cache_path}.")
    return cocktails

def save_place_matches(cocktails, place_matches_path):
    """Scan and save place matches for Layer 2."""
    matches = defaultdict(list)
    removed = []

    for c in cocktails:
        c_name = c["name"]
        c_lower = c_name.lower()

        # Check false positives
        is_fp = False
        for fp, reason in FALSE_POSITIVES.items():
            if re.search(r'\b' + re.escape(fp) + r'\b', c_lower):
                removed.append((c_name, fp, reason))
                is_fp = True
                break
        if is_fp:
            continue

        for pw, meta in SPECIAL_PLACE_WORDS.items():
            if re.search(r'\b' + re.escape(pw.lower()) + r'\b', c_lower):
                matches[meta["label"]].append(c["slug"])

    os.makedirs(os.path.dirname(place_matches_path), exist_ok=True)
    with open(place_matches_path, "w", encoding="utf-8") as f:
        json.dump({
            "special_places": SPECIAL_PLACE_WORDS,
            "place_matches": {k: list(set(v)) for k, v in matches.items()},
            "removed_false_positives": [{"name": r[0], "term": r[1], "reason": r[2]} for r in removed[:100]]
        }, f, indent=2)
    print(f"Saved place matches to {place_matches_path}.")

def print_example_city_menus(cocktails):
    """
    Print example results for:
    1. Portland, OR
    2. New Orleans, LA
    3. Phoenix, AZ
    4. Burlington, VT
    using sample weather so rules can be checked.
    """
    samples = [
        {
            "city": "Portland", "state": "Oregon", "code": "OR",
            "weather": {"temp_f": 48.0, "condition": "light rain", "humidity": 82, "wind_mph": 9}
        },
        {
            "city": "New Orleans", "state": "Louisiana", "code": "LA",
            "weather": {"temp_f": 74.0, "condition": "partly cloudy", "humidity": 76, "wind_mph": 6}
        },
        {
            "city": "Phoenix", "state": "Arizona", "code": "AZ",
            "weather": {"temp_f": 89.0, "condition": "clear", "humidity": 18, "wind_mph": 8}
        },
        {
            "city": "Burlington", "state": "Vermont", "code": "VT",
            "weather": {"temp_f": 36.0, "condition": "overcast", "humidity": 65, "wind_mph": 12}
        }
    ]

    print("\n" + "="*80)
    print("EXAMPLE CITY MENUS (TOP 6 DRINKS COMBINING LOCATION AND WEATHER)")
    print("="*80)

    for s in samples:
        city_label = f"{s['city']}, {s['code']}"
        w = s["weather"]
        w_str = f"{int(round(w['temp_f']))}°F, {w['condition']}, {w['humidity']}% humidity, wind {w['wind_mph']} mph"
        print(f"\nCITY: {city_label}")
        print(f"WEATHER: {w_str}")
        print("-" * 80)

        results = match_drinks_for_city(cocktails, s["city"], s["state"], s["code"], w, top_n=6)
        for idx, item in enumerate(results, 1):
            d = item["drink"]
            name = d["name"]
            str_val = d["strength"]
            reason = item["reason"]
            score = item["score"]

            # Format menu line: Name ......... Strength
            dots_len = max(50 - len(name) - len(str_val), 3)
            dots = "." * dots_len
            print(f"  {idx}. {name} {dots} {str_val}  [Score: {score}]")
            print(f"     Why: {reason}")
    print("\n" + "="*80 + "\n")

def main():
    parser = argparse.ArgumentParser(description="Fetch and process data for DrinksAtlas2")
    parser.add_argument("--refresh", action="store_true", help="Force fresh download of all data")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(script_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    brewery_cache = os.path.join(data_dir, "brewery_cache.json")
    cocktail_cache = os.path.join(data_dir, "cocktail_cache.json")
    place_matches = os.path.join(data_dir, "place_matches.json")

    # 1. Breweries
    breweries = fetch_breweries(brewery_cache, refresh=args.refresh)

    # 2. Cocktails
    cocktails = fetch_cocktails(cocktail_cache, refresh=args.refresh)

    # 3. Place Matches
    save_place_matches(cocktails, place_matches)

    # 4. Print 4 example city results
    print_example_city_menus(cocktails)

if __name__ == "__main__":
    main()
