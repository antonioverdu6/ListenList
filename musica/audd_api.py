import os
import re
import requests

#  Mejor guardar la clave en variables de entorno
AUDD_API_KEY = os.getenv("AUDD_API_KEY", "63515ae3aea8c5651f28ec29aa4a6b4d")

#  Activa esto en tu entorno local para ver la respuesta cruda
DEBUG_AUDD = os.getenv("DEBUG_AUDD", "false").lower() == "true"

def clean_string(s):
    """Limpia títulos y artistas para mejorar coincidencia en AudD."""
    if not s:
        return ""
    s = s.lower()
    s = re.sub(r"\(.*?\)|\[.*?\]", "", s)  # Elimina (feat. X), [remix], etc.
    s = re.sub(r"[^a-z0-9\s]", "", s)      # Solo letras, números y espacios
    s = re.sub(r"\s+", " ", s).strip()
    return s

import difflib

def similar(a, b):
    """Devuelve la similitud entre dos strings (0-1)."""
    return difflib.SequenceMatcher(None, clean_string(a), clean_string(b)).ratio()

def obtener_letra(cancion_nombre, artista_nombre=None):
    clean_title = clean_string(cancion_nombre)
    clean_artist = clean_string(artista_nombre) if artista_nombre else ""

    query = f"{clean_title} {clean_artist}".strip()

    url = "https://api.audd.io/findLyrics/"
    params = {
        "q": query,
        "api_token": AUDD_API_KEY
    }

    try:
        response = requests.get(url, params=params, timeout=8)
        data = response.json()

        if DEBUG_AUDD:
            print("AUDD RAW RESPONSE:", data)

        if data.get("status") == "success" and data.get("result"):
            # Buscar el match más parecido
            mejor_match = None
            mejor_score = 0

            for r in data["result"]:
                titulo_resp = r.get("title", "")
                artista_resp = r.get("artist", "")
                score_titulo = similar(clean_title, titulo_resp)
                score_artista = similar(clean_artist, artista_resp) if clean_artist else 1

                score_total = (score_titulo + score_artista) / 2

                if score_total > mejor_score:
                    mejor_score = score_total
                    mejor_match = r

            # Solo aceptar si la similitud es suficiente (ej: > 0.75)
            if mejor_match and mejor_score >= 0.75:
                return mejor_match.get("lyrics")

            # Fallback razonable: si no hay un match suficientemente alto, devolver la letra
            # del primer resultado que contenga 'lyrics' (esto puede tener falsos positivos,
            # pero suele ser mejor que no devolver nada).
            for r in data.get("result", []):
                lyrics = r.get("lyrics")
                if lyrics:
                    if DEBUG_AUDD:
                        print("AUDD FALLBACK: devolviendo primera letra disponible con score", mejor_score)
                    return lyrics

        # Segundo intento: solo con el título
        if clean_artist:
            params["q"] = clean_title
            response = requests.get(url, params=params)
            data = response.json()

            if DEBUG_AUDD:
                print("AUDD RETRY RESPONSE:", data)

            if data.get("status") == "success" and data.get("result"):
                for r in data["result"]:
                    if similar(clean_title, r.get("title", "")) >= 0.8:
                        return r.get("lyrics")

    except Exception as e:
        print("Error al obtener la letra:", e)

    return None
