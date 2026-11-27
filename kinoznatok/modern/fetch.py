"""Подбирает вышедшие фильмы 2000–2026 годов и сохраняет карточки TMDB для викторины."""
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo

from kinoznatok.tmdb.fetch import ApiError, media_path, request, working_auth


COUNT_PER_YEAR = 8
FIRST_YEAR, LAST_YEAR = 2000, 2026
RU_RATINGS = {"0+": 0, "6+": 6, "12+": 12, "16+": 16, "18+": 18}
US_RATINGS = {"G": 0, "PG": 6, "PG-13": 12, "R": 16, "NC-17": 18}


def age_for(item):
    release = (item.get("release_dates") or {}).get("results") or []
    for country, ratings in (("RU", RU_RATINGS), ("US", US_RATINGS)):
        values = []
        for group in release:
            if group.get("iso_3166_1") != country:
                continue
            for entry in group.get("release_dates") or []:
                rating = (entry.get("certification") or "").upper().replace(" ", "")
                if rating in ratings:
                    values.append(ratings[rating])
        if values:
            return max(values), country
    genres = {g.get("id") for g in item.get("genres") or []}
    return (6 if 10751 in genres else 16 if 27 in genres else 12), "фильтр викторины"


def story_movie(auth, ident, year, cutoff):
    try:
        obj = request(f"movie/{ident}", auth, language="ru-RU", append_to_response="credits,release_dates")
    except ApiError as exc:
        if exc.code == 404:
            return None
        raise
    if obj.get("id") != ident or obj.get("adult") is True or obj.get("video") is True:
        return None
    try:
        released = date.fromisoformat(obj.get("release_date") or "")
    except ValueError:
        return None
    if released.year != year or released > cutoff:
        return None
    title = obj.get("title") or obj.get("original_title")
    poster = media_path(obj, "poster_path")
    if not title or not poster:
        return None
    age, cert_country = age_for(obj)
    if age >= 18:
        return None
    credits = obj.get("credits") or {}
    directors = sorted({item["name"] for item in credits.get("crew") or [] if item.get("job") == "Director" and item.get("name")})
    cast = [
        [row["name"], (row.get("character") or "").strip()]
        for row in credits.get("cast") or [] if row.get("name")
    ]
    if not directors or len(cast) < 4:
        return None
    genres = [[x["id"], x["name"]] for x in obj.get("genres") or [] if x.get("id") and x.get("name")]
    return {
        "id": ident, "title": title, "original_title": obj.get("original_title"),
        "release_date": released.isoformat(), "language": obj.get("original_language"),
        "countries": [[c["iso_3166_1"], c["name"]] for c in obj.get("production_countries") or []
                      if c.get("iso_3166_1") and c.get("name")],
        "genres": genres, "age": age, "age_source": cert_country,
        "poster_path": poster, "directors": directors, "cast": cast,
        "source_url": f"https://www.themoviedb.org/movie/{ident}",
    }


def discover(auth, year, cutoff, local=False, page=1):
    fields = {
        "language": "ru-RU", "include_adult": "false", "include_video": "false",
        "primary_release_date.gte": f"{year}-01-01",
        "primary_release_date.lte": min(cutoff, date(year, 12, 31)).isoformat(),
        "without_genres": "16,27,99",
        "vote_count.gte": (7 if year >= 2025 else 20) if local else (50 if year >= 2025 else 100),
        "sort_by": "vote_count.desc" if local else "popularity.desc",
        "page": page,
    }
    if local:
        fields["with_original_language"] = "ru"
    data = request("discover/movie", auth, **fields)
    entries = data.get("results") or []
    return [row for row in entries if type(row.get("id")) is int and row.get("poster_path")]


def by_year(auth, year, cutoff):
    local = discover(auth, year, cutoff, local=True)[:8]
    general = discover(auth, year, cutoff)[:17]
    variants = {r["id"]: r for r in local + general}
    collected = []
    used = set()
    under16 = 0
    for row in list(variants.values()):
        if len(collected) >= COUNT_PER_YEAR:
            break
        if row["id"] in used:
            continue
        used.add(row["id"])
        local_count = sum(film["language"] == "ru" for film in collected)
        if row.get("original_language") == "ru" and local_count >= 2:
            continue
        film = story_movie(auth, row["id"], year, cutoff)
        if not film:
            continue
        if film["age"] == 16 and len(collected) - under16 >= 2:
            continue
        if film["age"] <= 12:
            under16 += 1
        collected.append(film)
    if len(collected) < COUNT_PER_YEAR:
        for row in discover(auth, year, cutoff, page=2):
            if row["id"] in used:
                continue
            film = story_movie(auth, row["id"], year, cutoff)
            if film and film["age"] <= 12:
                collected.append(film)
            if len(collected) >= COUNT_PER_YEAR:
                break
    if len(collected) != COUNT_PER_YEAR:
        raise ValueError(f"Год {year}: отобрано {len(collected)} из {COUNT_PER_YEAR}.")
    return collected


def main():
    cutoff = datetime.now(ZoneInfo("Europe/Moscow")).date()
    auth = working_auth()
    print(f"TMDB подтвердил доступ. Выпуски по {cutoff.isoformat()} включительно.", flush=True)
    years = range(FIRST_YEAR, LAST_YEAR + 1)
    records = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        for year, movies in zip(years, executor.map(lambda y: by_year(auth, y, cutoff), years)):
            records.extend(movies)
            print(f"{year}: {len(movies)} фильмов.", flush=True)
    payload = {
        "source": "TMDB", "as_of": cutoff.isoformat(), "count": len(records),
        "attribution": "This product uses the TMDB API but is not endorsed or certified by TMDB.",
        "records": records,
    }
    out = Path("out/modern-movies.json")
    out.parent.mkdir(exist_ok=True)
    tmp = out.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(out)
    print(f"Сохранено карточек фильмов: {len(records)}.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except (ApiError, ValueError) as exc:
        raise SystemExit(str(exc)) from None
