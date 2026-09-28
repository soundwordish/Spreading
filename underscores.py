import re

def bulletproof_underscore_and_flip(raw_index_path, source_path, out_corpus_path, out_index_path):
    # 1. Load the raw index file
    with open(raw_index_path, 'r', encoding='utf-8') as f:
        raw_lines = [line.strip() for line in f if line.strip()]

    corrected_plants_spaced = []
    final_index_lines = []

    print("--- 1. PROCESSING BOTANY INDEX ---")
    for line in raw_lines:
        # Revert any accidental underscores back to spaces so we can read it cleanly
        clean_line = line.replace('_', ' ')
        
        # Check for the comma to trigger the flip
        if ',' in clean_line:
            parts = [p.strip() for p in clean_line.split(',') if p.strip()]
            parts.reverse()  # Flip the order
            corrected_name = ' '.join(parts)
            print(f"  [FLIPPED] '{line}'  --->  '{corrected_name}'")
        else:
            corrected_name = clean_line.strip()

        # Remove any accidental double spaces
        corrected_name = re.sub(r'\s+', ' ', corrected_name)

        # If it's a multi-word plant, add it to our search list
        if ' ' in corrected_name:
            corrected_plants_spaced.append(corrected_name)
        
        # Build the final underscored index list for p5.js ("Starry_Campion")
        final_index_lines.append(corrected_name.replace(' ', '_') + '\n')

    # Sort descending by length so longer phrases are processed first
    corrected_plants_spaced.sort(key=len, reverse=True)

    # 2. Load the original literature
    with open(source_path, 'r', encoding='utf-8') as f:
        corpus = f.read()

    total_replacements = 0
    print(f"\n--- 2. SEARCHING LITERATURE FOR {len(corrected_plants_spaced)} PLANTS ---")

    # 3. Find and replace in the corpus
    for plant in corrected_plants_spaced:
        underscored_plant = plant.replace(' ', '_')
        
        # Break into pieces to catch any weird tabs/newlines between the words
        parts = plant.split(' ')
        regex_pattern = r'\b' + r'\s+'.join(re.escape(p) for p in parts) + r'\b'
        pattern = re.compile(regex_pattern, re.IGNORECASE)
        
        matches = len(pattern.findall(corpus))
        if matches > 0:
            corpus = pattern.sub(underscored_plant, corpus)
            total_replacements += matches
            print(f"  -> Replaced {matches} instance(s) of: '{plant}' with '{underscored_plant}'")

    # 4. Save the cleanly underscored literature
    with open(out_corpus_path, 'w', encoding='utf-8') as f:
        f.write(corpus)

    # 5. Save the perfectly underscored and flipped index file for p5.js
    with open(out_index_path, 'w', encoding='utf-8') as f:
        f.writelines(final_index_lines)

    print("\n--- 3. FINISHED! ---")
    print(f"Made {total_replacements} total replacements in the literature.")
    print(f"Updated literature saved as: {out_corpus_path}")
    print(f"Corrected, ready-for-p5 index saved as: {out_index_path}")

# Run the function
bulletproof_underscore_and_flip(
    raw_index_path='botany_index.txt', 
    source_path='botany_raw.txt', 
    out_corpus_path='underscored_literature.txt', 
    out_index_path='underscored_botany_index.txt'
)