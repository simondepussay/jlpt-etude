#!/usr/bin/env python3
"""Mots des niveaux N2–N5 qui servent d'exemples de lecture pour les kanji N1.

Le JLPT ne demande jamais la lecture d'un kanji seul, mais celle d'un mot (漢字読み).
Beaucoup de kanji N1 n'apparaissent dans aucun mot de la liste N1 : on leur donne
des mots des niveaux inférieurs pour poser la question « Comment se lit ce mot ? ».

Usage : python3 outils/mots_kanji.py chemin/vers/fichier.xlsx
Nécessite openpyxl. Produit web/data/n1-kanji-mots.js : { kanji: [[mot, lecture], …] }
"""
import json, re, sys, pathlib
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "data"
KANA = re.compile(r"^[ぁ-ゖァ-ヺー]+$")
PAR_KANJI = 4   # mots au plus par kanji
MIN_N1 = 2      # on n'ajoute rien si le kanji a déjà ce nombre de mots N1 lisibles


def charge(path):
    src = (DATA / path).read_text(encoding="utf-8")
    return json.loads(src[src.index("=[") + 1:src.rindex("]") + 1])


def main(xlsx):
    kanji = [k["k"] for k in charge("n1-kanji.js")]
    n1 = charge("n1-vocab.js")
    n1_mots = {}
    for v in n1:
        if v["w"] != v["r"]:
            for c in set(v["w"]):
                n1_mots[c] = n1_mots.get(c, 0) + 1

    wb = openpyxl.load_workbook(xlsx, read_only=True)
    mots = []  # du plus proche du N1 au plus simple
    for lvl in ["N2", "N3", "N4", "N5"]:
        for r in wb[f"{lvl} Vocab"].iter_rows(values_only=True):
            if not r or not r[0] or not r[1]:
                continue
            w, lec = str(r[0]).strip(), str(r[1]).strip()
            if w == "Kanji" or w.startswith("=") or w == lec or not KANA.match(lec):
                continue
            mots.append((w, lec))

    sortie, vus = {}, set()
    for k in kanji:
        if n1_mots.get(k, 0) >= MIN_N1:
            continue
        choix = []
        for w, lec in mots:
            if k in w and (w, lec) not in choix:
                choix.append((w, lec))
            if len(choix) >= PAR_KANJI:
                break
        if choix:
            sortie[k] = [list(x) for x in choix]
            vus.update(choix)

    (DATA / "n1-kanji-mots.js").write_text(
        "/* Mots N2–N5 servant d'exemples de lecture pour les kanji N1 (généré par outils/mots_kanji.py). */\n"
        "window.DATA=window.DATA||{};window.DATA['N1-kanji-mots']="
        + json.dumps(sortie, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"{len(sortie)} kanji reçoivent {len(vus)} mots d'exemple")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
