import re

def scrub_poetry_file(input_filename, output_filename):
    print(f"Opening {input_filename} for cleaning...")
    
    with open(input_filename, 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Remove everything between brackets (including multi-line notes)
    # The re.DOTALL flag ensures it catches notes that span across line breaks
    text = re.sub(r'\[.*?\]', '', text, flags=re.DOTALL)

    cleaned_lines = []
    
    # Process the remaining text line by line
    for line in text.split('\n'):
        stripped_line = line.strip()
        
        # Skip completely blank lines if you want, or keep them. 
        # (We will keep them here to maintain readability of the output file)
        if not stripped_line:
            cleaned_lines.append(line)
            continue
            
        # 2. Check for Roman Numerals (e.g., I, II., XIV, LXI.)
        # This regex strictly matches valid Roman numeral sequences standing alone on a line
        roman_regex = r'^(?=[MDCLXVI])M*(C[MD]|D?C{0,3})(X[CL]|L?X{0,3})(I[XV]|V?I{0,3})\.?$'
        if re.match(roman_regex, stripped_line):
            continue  # Skip this line
            
        # 3. Check for ALL CAPS Titles
        # If the line contains at least one uppercase letter, but ZERO lowercase letters
        if bool(re.search(r'[A-Z]', stripped_line)) and not bool(re.search(r'[a-z]', stripped_line)):
            continue  # Skip this line
            
        # If it passes all tests, keep the line
        cleaned_lines.append(line)

    # Write the beautifully clean text to a new file
    with open(output_filename, 'w', encoding='utf-8') as f:
        f.write('\n'.join(cleaned_lines))
        
    print(f"Cleaning complete! Saved as {output_filename}")

if __name__ == "__main__":
    # Input: your raw file. Output: the file the main amoeba script will look for.
    scrub_poetry_file('Emily Dickinson.txt', 'dickinson.txt')