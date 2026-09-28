import os
import re
import json
import urllib.request
import difflib
from collections import Counter, defaultdict
import nltk
from nltk.corpus import cmudict
from g2p_en import G2p

# Satisfy NLTK and g2p_en dependencies
nltk.download('cmudict', quiet=True)
nltk.download('averaged_perceptron_tagger', quiet=True)
nltk.download('averaged_perceptron_tagger_eng', quiet=True)

cmu_dict = cmudict.dict()
g2p = G2p()

def get_conversational_stoplist():
    url = "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa.txt"
    try:
        with urllib.request.urlopen(url) as resp:
            lines = resp.read().decode('utf-8').splitlines()
            return set(w.lower() for w in lines[:4000])
    except Exception:
        return {"the", "and", "that", "have", "for", "not", "with"}

COMMON_MASK = get_conversational_stoplist()

# This list acts like your old PRIORITY_WORDS. sketch.js uses 'is_special' 
# to make these words bold and larger on the canvas.
PRESERVED_BOTANICAL_ROOTS = set([
    "root", "leaf", "stem", "seed", "bloom", "flower", "thorn", "branch", 
    "bud", "moss", "spore", "soil", "dirt", "weed", "sap", "bark",
    "calyx", "corolla", "stamen", "petal", "sepal", "anther", "pollen"
])

def clean_token(token):
    t = re.sub(r"[^\w\-']", '', token).strip("-'").lower()
    return t if len(t) > 2 and not t.isdigit() else ""

def normalize_phones(phones):
    return [re.sub(r'\d+', '', p) for p in phones if p and p != ' ']

def build_lexicon(data_dir, window_size=8):
    word_counts = Counter()
    file_token_sequences = []

    print(f"Scanning files in '{data_dir}'...")
    for root, _, files in os.walk(data_dir):
        for f in files:
            if not f.endswith(".txt"):
                continue
            filepath = os.path.join(root, f)
            print(f" -> Reading: {f}")
            
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as infile:
                text = infile.read()

            raw_tokens = re.split(r'\s+', text)
            valid_sequence = []
            
            for raw_t in raw_tokens:
                w = clean_token(raw_t)
                if not w:
                    continue
                if w in COMMON_MASK and w not in PRESERVED_BOTANICAL_ROOTS:
                    continue
                
                valid_sequence.append(w)
                word_counts[w] += 1
                
            file_token_sequences.append(valid_sequence)

    unique_words = list(word_counts.keys())
    total_words = len(unique_words)
    print(f"Read complete. Found {total_words} unique filtered vocabulary terms.")
    
    # 1. Phonemes
    print("Translating phonemes...")
    word_to_phonemes = {}
    for w in unique_words:
        if w in cmu_dict:
            phones = cmu_dict[w][0]
        else:
            phones = g2p(w)
        word_to_phonemes[w] = normalize_phones(phones)

    # 2. Semantic Proximity
    print("Calculating semantic proximity map...")
    co_occurrences = defaultdict(lambda: defaultdict(int))
    for sequence in file_token_sequences:
        seq_len = len(sequence)
        for i, word in enumerate(sequence):
            for j in range(1, window_size + 1):
                if i + j < seq_len:
                    neighbor = sequence[i + j]
                    if word != neighbor:
                        co_occurrences[word][neighbor] += 1

    # 3. Build Final Nested Dictionary
    lexicon = {}
    print("Formatting JSON for p5.js canvas...")
    
    for i, word in enumerate(unique_words):
        if i % 500 == 0:
            print(f"Processed {i} out of {total_words} words...")

        word_data = {}

        # --- SEMANTIC (Proximity) ---
        neighbors = co_occurrences.get(word, {})
        if neighbors:
            sem_ghosts = []
            sorted_neighbors = sorted(neighbors.items(), key=lambda x: x[1], reverse=True)
            for w2, weight in sorted_neighbors[:5]:
                final_weight = min(1.0, weight / 10.0)
                if w2 in PRESERVED_BOTANICAL_ROOTS: final_weight = 1.0
                sem_ghosts.append({
                    "word": w2, 
                    "weight": round(final_weight, 3), 
                    "is_special": w2 in PRESERVED_BOTANICAL_ROOTS
                })
            word_data["semantic"] = sem_ghosts

        # --- ORTHOGRAPHIC (Spelling) ---
        ortho_matches = difflib.get_close_matches(word, unique_words, n=6, cutoff=0.70)
        ortho_ghosts = []
        for match in ortho_matches:
            if match != word:
                ratio = difflib.SequenceMatcher(None, word, match).ratio()
                ortho_ghosts.append({
                    "word": match, 
                    "weight": round(ratio, 3), 
                    "is_special": match in PRESERVED_BOTANICAL_ROOTS
                })
        if ortho_ghosts:
            word_data["orthographic"] = sorted(ortho_ghosts, key=lambda x: x["weight"], reverse=True)[:5]

        # --- PHONETIC (Sound) ---
        target_phones = word_to_phonemes.get(word, [])
        if len(target_phones) >= 2:
            phone_ghosts = []
            for candidate in unique_words:
                if candidate != word:
                    cand_phones = word_to_phonemes.get(candidate, [])
                    if len(cand_phones) >= 2:
                        # Match if they share onset or rhyme
                        if target_phones[:2] == cand_phones[:2] or target_phones[-2:] == cand_phones[-2:]:
                            phone_ghosts.append({
                                "word": candidate, 
                                "weight": 0.8, 
                                "is_special": candidate in PRESERVED_BOTANICAL_ROOTS
                            })
                            if len(phone_ghosts) >= 5:
                                break
            if phone_ghosts:
                word_data["phonetic"] = phone_ghosts

        # Only add word to lexicon if it has at least one connection
        if word_data:
            lexicon[word] = word_data

    # Write Output
    out_file = "meadow_lexicon.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(lexicon, f, indent=2)
        
    print(f"\nDone! New {out_file} saved.")

if __name__ == "__main__":
    raw_dir = "data"  # Ensure this points to the folder containing your historical texts
    build_lexicon(raw_dir)