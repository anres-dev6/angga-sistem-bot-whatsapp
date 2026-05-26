import os
import re

def clean_comments(file_path):
    """Remove excessive // comments from JavaScript files"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        cleaned_lines = []
        changes_made = False
        
        for line in lines:
            original_line = line
            stripped = line.lstrip()
            
            # Skip if line is only a comment
            if stripped.startswith('//'):
                # Keep important comments (section headers with ====)
                if '====' in line or 'IMPORTANT' in line.upper() or 'TODO' in line.upper():
                    cleaned_lines.append(line)
                else:
                    changes_made = True
                    continue
            
            # Remove inline comments but keep the code
            if '//' in line and not stripped.startswith('//'):
                # Check if it's inside a string
                in_string = False
                quote_char = None
                comment_pos = -1
                
                for i, char in enumerate(line):
                    if char in ['"', "'", '`'] and (i == 0 or line[i-1] != '\\'):
                        if not in_string:
                            in_string = True
                            quote_char = char
                        elif char == quote_char:
                            in_string = False
                            quote_char = None
                    elif char == '/' and i < len(line) - 1 and line[i+1] == '/' and not in_string:
                        comment_pos = i
                        break
                
                if comment_pos > 0:
                    # Remove the comment but keep trailing newline
                    new_line = line[:comment_pos].rstrip() + '\n'
                    if new_line.strip():  # Only if there's code left
                        cleaned_lines.append(new_line)
                        changes_made = True
                    else:
                        changes_made = True
                    continue
            
            cleaned_lines.append(line)
        
        if changes_made:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(cleaned_lines)
            return True
        return False
    
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return False

def process_directory(directory, exclude_dirs=['node_modules', '.git', 'auth', '.wwebjs_auth']):
    """Process all .js files in directory recursively"""
    files_cleaned = 0
    total_files = 0
    
    for root, dirs, files in os.walk(directory):
        # Remove excluded directories from dirs list
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if file.endswith('.js'):
                file_path = os.path.join(root, file)
                total_files += 1
                
                if clean_comments(file_path):
                    files_cleaned += 1
                    print(f"✓ Cleaned: {file_path}")
    
    print(f"\n{'='*50}")
    print(f"Total files processed: {total_files}")
    print(f"Files cleaned: {files_cleaned}")
    print(f"{'='*50}")

if __name__ == "__main__":
    project_dir = r"c:\Angga-Bot"
    print(f"Cleaning comments from: {project_dir}\n")
    process_directory(project_dir)
    print("\n✅ Cleanup complete!")
