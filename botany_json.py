import re
import json
import difflib
import pronouncing
from collections import defaultdict, Counter

EXCLUSION_LIST = set([
    "god", "heaven", "lord", "christ", "grace", 
    "soul", "divine", "holy", "prayer", "sin"
])

PRIORITY_WORDS = set([
    "arbutus", "gentian", "anemone", "aster", "daffodil", "tulip", 
    "orchid", "crocus", "violet", "amaranth", "hemlock", "clover",
    "dandelion", "daisy", "rose", "buttercup",
    "meadow", "blossom", "stamen", "corolla", "fern", "root", 
    "petal", "sepal", "anther", "pollen", "spore", "canopy",
    "moss", "lichen", "bloom", "thicket", "bramble", "vine",
    "stem", "calyx", "bough", "seed", "sap", "leaf", "bark",
    "dawn", "dew", "breeze", "gale", "frost", "orchard", "tide",
    "amber", "emerald", "ruby", "sapphire", "vernal", "equinox",
    "bee", "butterfly", "robin", "bobolink", "oriole", "sparrow", "chrysalis"
])

def clean_and_tokenize(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read().lower()
            # Updated regex: \b[a-z_]+\b allows underscores to remain part of the word
            words = re.findall(r'\b[a-z_]+\b', text)
            return [w for w in words if w not in EXCLUSION_LIST and len(w) > 2]
    except FileNotFoundError:
        print(f"Error: Could not find {filepath}")
        return []

def get_phonemes(word):
    # Handle multi-word plants by evaluating their parts separately and joining the phonemes
    parts = word.split('_')
    phones = []
    for part in parts:
        p = pronouncing.phones_for_word(part)
        if p:
            phones.append(p[0])
    return " ".join(phones) if phones else ""

def build_lexicon():
    print("Loading text files...")
    
    # Dynamically inject the newly underscored plants into the priority styling list
    try:
        with open("underscored_botany_index.txt", "r", encoding="utf-8") as f:
            botany_index = [line.strip().lower() for line in f if line.strip()]
            PRIORITY_WORDS.update(botany_index)
            print(f"Added {len(botany_index)} plants to the Priority Words list.")
    except FileNotFoundError:
        print("Warning: underscored_botany_index.txt not found. Priority boost will not be applied to new plants.")

    # Load the properly underscored literature
    master_corpus = clean_and_tokenize("underscored_literature.txt")
    
    if not master_corpus:
        print("Corpus is empty. Check your file paths.")
        return
        
    unique_words = list(set(master_corpus))
    
    sequential_map = defaultdict(list)
    for i in range(len(master_corpus) - 1):
        sequential_map[master_corpus[i]].append(master_corpus[i + 1])

    print("Translating phonemes...")
    word_to_phonemes = {w: get_phonemes(w) for w in unique_words}
    valid_phonetic_words = [w for w in unique_words if word_to_phonemes[w]]

    lexicon = {}
    total_words = len(unique_words)
    
    print("Calculating connections...")
    for i, word in enumerate(unique_words):
        if i % 500 == 0:
            print(f"Processed {i} out of {total_words} words...")

        word_data = {}

        # 1. SEMANTIC
        followers = [w for w in sequential_map.get(word, []) if w != word]
        if followers:
            counts = Counter(followers)
            total_followers = len(followers)
            sem_ghosts = []
            for w, c in counts.items():
                weight = round(c / total_followers, 3)
                if w in PRIORITY_WORDS: weight += 2.0 
                sem_ghosts.append({"word": w, "weight": weight, "is_special": w in PRIORITY_WORDS})
            
            sem_ghosts = sorted(sem_ghosts, key=lambda x: x["weight"], reverse=True)[:5]
            for g in sem_ghosts: g["weight"] = min(1.0, g["weight"])
            if sem_ghosts: word_data["semantic"] = sem_ghosts

        # 2. ORTHOGRAPHIC
        ortho_matches = difflib.get_close_matches(word, unique_words, n=6, cutoff=0.70)
        ortho_ghosts = []
        for match in ortho_matches:
            if match != word:
                ratio = difflib.SequenceMatcher(None, word, match).ratio()
                if match in PRIORITY_WORDS: ratio += 2.0 
                ortho_ghosts.append({"word": match, "weight": round(ratio, 3), "is_special": match in PRIORITY_WORDS})
        
        if ortho_ghosts:
            ortho_ghosts = sorted(ortho_ghosts, key=lambda x: x["weight"], reverse=True)[:5]
            for g in ortho_ghosts: g["weight"] = min(1.0, g["weight"])
            word_data["orthographic"] = ortho_ghosts

        # 3. PHONETIC
        target_phones = word_to_phonemes.get(word, "")
        if target_phones:
            phone_scores = []
            for candidate in valid_phonetic_words:
                if candidate != word:
                    cand_phones = word_to_phonemes[candidate]
                    ratio = difflib.SequenceMatcher(None, target_phones, cand_phones).ratio()
                    if ratio > 0.65:
                        if candidate in PRIORITY_WORDS: ratio += 2.0 
                        phone_scores.append({"word": candidate, "weight": round(ratio, 3), "is_special": candidate in PRIORITY_WORDS})
            
            if phone_scores:
                phone_scores = sorted(phone_scores, key=lambda x: x["weight"], reverse=True)[:5]
                for g in phone_scores: g["weight"] = min(1.0, g["weight"])
                word_data["phonetic"] = phone_scores

        if word_data:
            lexicon[word] = word_data

    with open("meadow_lexicon.json", "w", encoding="utf-8") as f:
        json.dump(lexicon, f, indent=2)
        
    print("Done! New meadow_lexicon.json saved.")

if __name__ == "__main__":
    build_lexicon()