"""Выгружает карточки TMDB для известных ID киноработ «КиноЗнатока»."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


# Карточки, по которым готовятся авторские формулировки для режима подсказок.
EDITORIAL_WORKS = {
    'Q91540', 'Q105031', 'Q167726', 'Q11621', 'Q51416', 'Q488655', 'Q387601', 'Q222939', 'Q25188',
    'Q13417189', 'Q18547944', 'Q46717', 'Q127367', 'Q218235', 'Q206576', 'Q22000542', 'Q777739',
    'Q1999930', 'Q625110', 'Q2528155', 'Q913426', 'Q53105', 'Q1195685', 'Q2306068', 'Q2368678',
    'Q4271831', 'Q1272202', 'Q21637453', 'Q737904', 'Q201293', 'Q79784', 'Q23831', 'Q728553',
    'Q13417244', 'Q8539', 'Q147235', 'Q386880', 'Q22908690', 'Q264221', 'Q192837', 'Q83071',
    'Q85808226', 'Q23673', 'Q23567', 'Q56876444', 'Q65980217', 'Q4249828', 'Q600931', 'Q1668081',
    'Q16272273', 'Q2332537', 'Q3500392', 'Q472018', 'Q2370768', 'Q134430', 'Q40895', 'Q179673',
    'Q215518', 'Q36479', 'Q36092', 'Q188439', 'Q15270647', 'Q18647981', 'Q103372692', 'Q132863',
    'Q182153', 'Q170035', 'Q104905', 'Q174811', 'Q6144664', 'Q5815826', 'Q483815', 'Q174555',
    'Q129193', 'Q156401', 'Q305250', 'Q67208596', 'Q260138', 'Q2682217', 'Q1965370', 'Q3999206',
    'Q4096274', 'Q4260298', 'Q4113875', 'Q2369324', 'Q39571', 'Q196602', 'Q155653', 'Q29011',
    'Q21697406'
}


class ApiError(RuntimeError):
    def __init__(self, code):
        self.code = code
        super().__init__(f"Ответ TMDB: {code}.")


def request(endpoint, auth, **params):
    headers = {"Accept": "application/json", "User-Agent": "KinoZnatok/2.0 catalog"}
    kind, secret = auth
    if kind == "bearer":
        headers["Authorization"] = "Bearer " + secret
    else:
        params["api_key"] = secret
    url = "https://api.themoviedb.org/3/" + endpoint
    if params:
        url += "?" + urlencode(params)
    for attempt in range(4):
        delay = 2 ** attempt
        try:
            with urlopen(Request(url, headers=headers), timeout=25) as response:
                value = json.load(response)
                if isinstance(value, dict):
                    return value
                raise ApiError("некорректный JSON")
        except HTTPError as error:
            retry = error.headers.get("Retry-After", "")
            if retry.isdecimal():
                delay = max(delay, min(int(retry), 30))
            code = error.code
            error.close()
            if code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise ApiError(code) from None
        except (URLError, TimeoutError, OSError) as error:
            if attempt == 3:
                raise ApiError("сбой сети") from None
        except (ValueError, UnicodeError):
            raise ApiError("некорректный JSON") from None
        time.sleep(delay)


def working_auth():
    bearer = re.sub(r"^Bearer\s+", "", os.getenv("TMDB_READ_TOKEN", "").strip(), flags=re.I)
    key = os.getenv("TMDB_API_KEY", "").strip()
    available = [(kind, value) for kind, value in (("bearer", bearer), ("key", key)) if value]
    if not available:
        raise SystemExit("Для запуска нужен секрет TMDB_READ_TOKEN или TMDB_API_KEY.")
    for auth in available:
        try:
            request("configuration", auth)
            return auth
        except ApiError as error:
            if error.code not in (401, 403):
                raise
    raise SystemExit("TMDB отклонил авторизацию. Проверьте значение сохранённого секрета GitHub.")


def validated_targets(path):
    rows = json.loads(path.read_bytes())
    if not isinstance(rows, list):
        raise ValueError("Список ID должен быть массивом.")
    result = {}
    for row in rows:
        if not isinstance(row, list) or len(row) != 3:
            raise ValueError("Ожидается запись [тип, ID TMDB, ID Wikidata].")
        kind, ident, work = row
        if kind not in ("movie", "tv") or type(ident) is not int or ident <= 0:
            raise ValueError("Недопустимый тип или ID TMDB.")
        if not isinstance(work, str) or not re.fullmatch(r"Q[1-9][0-9]*", work):
            raise ValueError("Некорректный ID Wikidata.")
        result.setdefault((kind, ident), set()).add(work)
    if not result:
        raise ValueError("Список ID пуст.")
    return result


def collect_names(values):
    return [item["name"] for item in values or [] if isinstance(item.get("name"), str) and item["name"]]


def media_path(item, name):
    value = item.get(name)
    return value if isinstance(value, str) and re.fullmatch(r"/[a-zA-Z0-9_\-]+\.(?:jpg|png|webp)", value) else None


def get_record(key, wikidata, auth):
    kind, ident = key
    source = f"https://www.themoviedb.org/{kind}/{ident}"
    try:
        item = request(f"{kind}/{ident}", auth, language="ru-RU", append_to_response="credits")
    except ApiError as error:
        if error.code == 404:
            return None
        raise
    if item.get("id") != ident:
        raise ApiError("ID карточки отличается от запроса")
    credits = item.get("credits") or {}
    return {
        "tmdb_id": ident,
        "wikidata_ids": sorted(wikidata),
        "type": kind,
        "source_url": source,
        "title": item.get("title") if kind == "movie" else item.get("name"),
        "original_title": item.get("original_title") if kind == "movie" else item.get("original_name"),
        "release_date": item.get("release_date") if kind == "movie" else item.get("first_air_date"),
        "original_language": item.get("original_language"),
        "country_codes": item.get("origin_country") or [
            c.get("iso_3166_1") for c in item.get("production_countries") or [] if c.get("iso_3166_1")
        ],
        "genres": collect_names(item.get("genres")),
        "directors": list(dict.fromkeys(collect_names([
            p for p in credits.get("crew") or [] if p.get("job") == "Director"
        ]))),
        "creators": collect_names(item.get("created_by")),
        "cast": [
            {"name": p["name"], "character": p.get("character") or None}
            for p in (credits.get("cast") or [])[:12] if p.get("name")
        ],
        **({"overview_for_editor": item.get("overview") or ""} if EDITORIAL_WORKS.intersection(wikidata) else {}),
        "poster_path": media_path(item, "poster_path"),
        "backdrop_path": media_path(item, "backdrop_path"),
    }


def build(target_path, output):
    targets = validated_targets(target_path)
    auth = working_auth()
    print("TMDB подтвердил доступ.", flush=True)
    records = []
    missing = []
    def lookup(entry):
        key, wikidata = entry
        return key, wikidata, get_record(key, wikidata, auth)
    with ThreadPoolExecutor(max_workers=4) as executor:
        for key, wikidata, record in executor.map(lookup, targets.items()):
            if record is None:
                missing.append({"type": key[0], "tmdb_id": key[1], "wikidata_ids": sorted(wikidata)})
            else:
                records.append(record)
    if not records:
        raise ValueError("TMDB не вернул ни одной карточки.")
    payload = {
        "schema": 1,
        "source": "TMDB",
        "source_url": "https://www.themoviedb.org",
        "attribution": "This product uses the TMDB API but is not endorsed or certified by TMDB.",
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "requested": len(targets),
        "received": len(records),
        "missing": missing,
        "records": records,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    pending = output.with_suffix(output.suffix + ".tmp")
    pending.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    pending.replace(output)
    print(f"Сохранено карточек: {len(records)} из {len(targets)}. Пропущено: {len(missing)}.", flush=True)
    log = os.getenv("GITHUB_STEP_SUMMARY")
    if log:
        with open(log, "a", encoding="utf-8") as summary:
            summary.write(f"TMDB подтвердил доступ. Карточек получено: **{len(records)}** из {len(targets)}.\n")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--targets", type=Path, default=Path(__file__).with_name("targets.json"))
    parser.add_argument("--output", type=Path, default=Path("out/tmdb_catalog.json"))
    args = parser.parse_args()
    try:
        build(args.targets, args.output)
    except (ApiError, ValueError) as error:
        raise SystemExit(str(error)) from None


if __name__ == "__main__":
    main()
