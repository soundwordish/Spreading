import re

def scrub_botany_file(input_filename, output_filename):
    print(f"Opening {input_filename} for cleaning...")
    
    with open(input_filename, 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Remove specific target words (case-insensitive to catch Fig, FIG, fig.)
    text = re.sub(r'\b(illustration|illustrations|fig)\b', '', text, flags=re.IGNORECASE)

    # 2. Remove words in ALL CAPS (2 or more letters)
    # We require 2+ letters so we don't accidentally delete the pronoun 'I' or article 'A'.
    # This brilliantly takes care of most Roman Numerals (II, IV, IX, XIII) at the same time!
    text = re.sub(r'\b[A-Z]{2,}\b', '', text)

    # 3. Remove standalone single-letter Roman Numerals (V, X, L, C, D, M)
    # Since we protected single letters in step 2 to save 'I' and 'A', we manually target the rest here.
    text = re.sub(r'\b[VXLCDM]\b', '', text)

    # 4. Remove all Arabic Numerals (0-9)
    text = re.sub(r'\d+', '', text)

    # 5. Destroy all punctuation, brackets, and lines (replace with a space)
    # This targets standard punctuation plus the specific ones you mentioned: [ ] ( ) : = — _
    # The \- catches standard hyphens, \— catches em-dashes, and _ catches the underline.
    punctuation_to_remove = r'[\[\]():=_\-—"\'.,;!?*&^%$#@<>/\\|~`{}]'
    text = re.sub(punctuation_to_remove, ' ', text)

    # 6. Clean up the leftover spacing
    # All those deletions will leave huge gaps of empty spaces. This shrinks them down.
    text = re.sub(r' +', ' ', text)

    # Write the earthy, biological vocabulary to a new file
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write(text.strip())
        
    print(f"Cleaning complete! Saved as {output_filename}")

if __name__ == "__main__":
    scrub_botany_file('botany_raw.txt', 'botany.txt')